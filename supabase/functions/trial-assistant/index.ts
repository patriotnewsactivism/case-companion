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
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'trial-assistant', corsHeaders);
    }

    const { user, supabase } = authResult;

    // Higher rate limit since this is called per exchange
    const rateLimitCheck = checkRateLimit(`trial-assistant:${user.id}`, 60, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { caseId, mode, lastQuestion, lastAnswer, recentHistory } = await req.json();
    if (!caseId || !lastQuestion) {
      return new Response(JSON.stringify({ error: 'caseId and lastQuestion required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch comprehensive discovery data for evidence references
    const { data: documents } = await supabase
      .from('documents')
      .select('name, bates_number, summary, key_facts, favorable_findings, adverse_findings, action_items, ocr_text')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .order('created_at', { ascending: false })
      .limit(15);

    const docContext = (documents || []).map((d: Record<string, unknown>) => {
      const parts: string[] = [`[${d.bates_number || d.name}]`];
      if (d.summary) parts.push(`Summary: ${d.summary as string}`);
      if (Array.isArray(d.key_facts) && d.key_facts.length) {
        parts.push(`Key Facts: ${(d.key_facts as string[]).slice(0, 3).join('; ')}`);
      }
      if (Array.isArray(d.favorable_findings) && d.favorable_findings.length) {
        parts.push(`Favorable: ${(d.favorable_findings as string[]).slice(0, 2).join('; ')}`);
      }
      if (Array.isArray(d.adverse_findings) && d.adverse_findings.length) {
        parts.push(`Adverse: ${(d.adverse_findings as string[]).slice(0, 2).join('; ')}`);
      }
      if (Array.isArray(d.action_items) && d.action_items.length) {
        parts.push(`Actions: ${(d.action_items as string[]).slice(0, 2).join('; ')}`);
      }
      return parts.join(' | ');
    }).join('\n');

    const recentConversation = Array.isArray(recentHistory)
      ? (recentHistory as Array<{ role: string; content: string }>)
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'Attorney' : 'Witness/Opponent'}: ${m.content}`)
          .join('\n')
      : '';

    const prompt = `You are an expert trial advocacy coach providing real-time guidance during a ${mode || 'trial'} practice session. You have access to comprehensive discovery materials and must provide tactical, evidence-based coaching.

LAST EXCHANGE:
Attorney asked: "${lastQuestion}"
Witness/Opponent answered: "${lastAnswer || '(no answer yet)'}"

RECENT CONVERSATION:
${recentConversation || 'Beginning of session'}

DISCOVERY DATABASE (use this to provide evidence-based coaching):
${docContext || 'No discovery materials available - focus on general trial tactics'}

COACHING INSTRUCTIONS:
- Reference specific documents/facts when suggesting follow-ups or objections
- Identify when answers contradict discovery materials
- Suggest impeachment opportunities based on adverse findings
- Recommend using favorable findings to strengthen positions
- Flag when testimony creates openings to introduce key evidence
- Provide tactical advice based on the specific case facts available

Analyze this exchange and provide real-time coaching. Respond with ONLY valid JSON:
{
  "objectionAlert": {
    "isObjectionable": true/false,
    "objectionType": "Hearsay|Leading|Relevance|Speculation|Foundation|Compound|Argumentative|null",
    "grounds": "Brief explanation of why this was objectionable, or null if not objectionable"
  },
  "answerAnalysis": {
    "isEvasive": true/false,
    "evasionTactic": "How the witness is evading (hedging, non-responsive, etc.) or null",
    "trapAlert": "Alert if the witness left an opening you should exploit, or null"
  },
  "suggestedFollowUps": [
    "Most impactful next question",
    "Alternative follow-up",
    "Trap follow-up question"
  ],
  "evidenceReference": {
    "relevantDoc": "Document that supports or contradicts what was just said, or null",
    "howToUse": "How to use this document now, or null"
  },
  "coachingNote": "One concise tactical observation (max 2 sentences)"
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
      // Return empty coaching rather than failing hard
      return new Response(JSON.stringify({
        objectionAlert: { isObjectionable: false, objectionType: null, grounds: null },
        answerAnalysis: { isEvasive: false, evasionTactic: null, trapAlert: null },
        suggestedFollowUps: [],
        evidenceReference: { relevantDoc: null, howToUse: null },
        coachingNote: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData?.choices?.[0]?.message?.content || "{}";

    let coaching: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      coaching = JSON.parse(jsonStr.trim());
    } catch {
      coaching = {
        objectionAlert: { isObjectionable: false, objectionType: null, grounds: null },
        answerAnalysis: { isEvasive: false, evasionTactic: null, trapAlert: null },
        suggestedFollowUps: [],
        evidenceReference: { relevantDoc: null, howToUse: null },
        coachingNote: null,
      };
    }

    return new Response(JSON.stringify(coaching), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("trial-assistant error:", e);
    return createErrorResponse(e, 500, 'trial-assistant', corsHeaders);
  }
});
