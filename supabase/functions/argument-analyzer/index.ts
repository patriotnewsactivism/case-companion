import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'argument-analyzer', corsHeaders);
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`argument-analyzer:${user.id}`, 10, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { briefId, caseId } = await req.json();
    if (!briefId || !caseId) {
      return new Response(JSON.stringify({ error: 'briefId and caseId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch brief
    const { data: brief } = await supabase
      .from('legal_briefs')
      .select('title, type, content, court, status')
      .eq('id', briefId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!brief || !brief.content) {
      return new Response(JSON.stringify({ error: 'Brief not found or has no content' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch case + documents for context
    const { data: caseData } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation, case_theory, key_issues')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: documents } = await supabase
      .from('documents')
      .select('name, bates_number, summary, key_facts, favorable_findings, adverse_findings')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .limit(10);

    const docContext = (documents || []).map((d: Record<string, unknown>) => {
      const parts: string[] = [`[${d.bates_number || d.name}]`];
      if (d.summary) parts.push(d.summary as string);
      if (Array.isArray(d.key_facts) && d.key_facts.length) parts.push(d.key_facts.join('; '));
      return parts.join(': ');
    }).join('\n');

    const systemPrompt = `You are a federal appellate judge and former BigLaw senior partner who has reviewed thousands of motions and briefs.
Provide a rigorous, honest assessment of this ${brief.type}'s legal arguments.

CASE: ${caseData?.name || 'Unknown'} (${caseData?.case_type || 'Unknown'})
COURT: ${brief.court || 'Not specified'}
REPRESENTATION: ${caseData?.representation || 'Not specified'} for ${caseData?.client_name || 'client'}
CASE THEORY: ${caseData?.case_theory || 'Not specified'}

AVAILABLE EVIDENCE:
${docContext || 'No analyzed documents available.'}

BRIEF TITLE: ${brief.title}
BRIEF CONTENT:
${brief.content.slice(0, 12000)}

Analyze this brief and respond with ONLY valid JSON:
{
  "overallScore": 0-100,
  "predictedReception": "favorable|neutral|unfavorable|mixed",
  "judgeFirstImpression": "What the judge thinks in the first 30 seconds of reading",
  "argumentScores": [
    {
      "argument": "Main argument heading or section",
      "score": 0-100,
      "strengths": ["what works well"],
      "weaknesses": ["what is weak or vulnerable"],
      "missingCitations": ["specific cases or statutes that would strengthen this argument"],
      "counterarguments": ["what opposing counsel will argue in response"],
      "suggestedRevision": "One concrete improvement for this section"
    }
  ],
  "strongestArgument": "Name the single most persuasive argument",
  "weakestArgument": "Name the single weakest argument that opposing counsel will attack",
  "missingElements": ["What is missing that is needed for a complete filing"],
  "citationGaps": ["Legal propositions stated without authority"],
  "proceduralIssues": ["Any procedural defects or formatting concerns"],
  "overallAssessment": "2-3 sentence bottom-line assessment of litigation posture and likelihood of success",
  "topThreeImprovements": ["The single most impactful change to make", "Second most important change", "Third most important change"]
}`;

    // AI provider selection
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string, apiKey: string, model: string;

    if (AI_GATEWAY_URL) {
      apiUrl = AI_GATEWAY_URL; apiKey = OPENAI_API_KEY || GOOGLE_AI_API_KEY || ""; model = "gpt-4o-mini";
    } else if (GOOGLE_AI_API_KEY) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = GOOGLE_AI_API_KEY; model = "gemini-2.0-flash";
    } else if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions"; apiKey = OPENAI_API_KEY; model = "gpt-4o-mini";
    } else {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: systemPrompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";

    let analysis: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      analysis = JSON.parse(jsonStr.trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("argument-analyzer error:", e);
    return createErrorResponse(e, 500, 'argument-analyzer', corsHeaders);
  }
});
