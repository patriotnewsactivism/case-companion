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
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'cross-document-analysis', corsHeaders);
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`cross-doc:${user.id}`, 5, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { caseId } = await req.json();
    if (!caseId) {
      return new Response(JSON.stringify({ error: 'caseId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch case
    const { data: caseData } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation, case_theory, key_issues')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all analyzed documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, bates_number, summary, key_facts, favorable_findings, adverse_findings, created_at')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .order('bates_number', { ascending: true, nullsFirst: false })
      .limit(40);

    const docs = documents || [];
    if (docs.length < 2) {
      return new Response(JSON.stringify({
        error: 'At least 2 analyzed documents are required for cross-document analysis.',
        documentsAnalyzed: docs.length,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build document summaries for AI (using already-extracted fields only — no OCR bulk)
    const docSummaries = docs.slice(0, 30).map((d: Record<string, unknown>) => {
      const parts: string[] = [`DOCUMENT: ${d.bates_number || d.name}`];
      if (d.summary) parts.push(`Summary: ${d.summary}`);
      if (Array.isArray(d.key_facts) && d.key_facts.length) parts.push(`Key Facts: ${d.key_facts.join('; ')}`);
      if (Array.isArray(d.favorable_findings) && d.favorable_findings.length) parts.push(`Favorable: ${d.favorable_findings.join('; ')}`);
      if (Array.isArray(d.adverse_findings) && d.adverse_findings.length) parts.push(`Adverse: ${d.adverse_findings.join('; ')}`);
      return parts.join('\n');
    }).join('\n\n');

    const systemPrompt = `You are a senior litigation analyst reviewing a complete case record for ${caseData.name}, a ${caseData.case_type} case where you represent the ${caseData.representation}.

Case Theory: ${caseData.case_theory || 'Not specified'}
Key Issues: ${(caseData.key_issues || []).join(', ') || 'Not specified'}

CASE DOCUMENTS (${docs.length} total):
${docSummaries}

Perform a comprehensive cross-document analysis. Identify:

1. FACTUAL CONTRADICTIONS: Where one document says X but another says Y about the same fact. Be specific with quotes.
2. KEY ADMISSIONS: Statements in any document that constitute admissions against the opposing party's interest or support our client.
3. RECORD GAPS: Important facts conspicuously absent from all documents that should be investigated or obtained in discovery.
4. STRONGEST EVIDENCE: Top 5 documents or facts that most powerfully support our client's position.
5. CASE WEAKNESSES: Facts established across documents that hurt our client's position.

Respond with ONLY valid JSON in this exact structure:
{
  "contradictions": [
    {
      "docA": "document identifier",
      "docB": "document identifier",
      "topic": "what the contradiction is about",
      "stateA": "what doc A says (quote if possible)",
      "stateB": "what doc B says (quote if possible)",
      "significance": "high|medium|low",
      "exploitStrategy": "how to use this contradiction at trial or in motions"
    }
  ],
  "admissions": [
    {
      "doc": "document identifier",
      "admission": "the admission (quote if possible)",
      "legalSignificance": "why this matters legally",
      "bestUsedAt": "deposition|trial|motion|settlement"
    }
  ],
  "gaps": [
    {
      "missingFact": "what is missing",
      "whyImportant": "why this matters to the case",
      "whereToFind": "where this evidence might exist",
      "discoveryAction": "specific discovery request to obtain it"
    }
  ],
  "strongestEvidence": [
    {
      "doc": "document identifier",
      "fact": "the powerful fact",
      "impact": "why this is powerful for our position"
    }
  ],
  "weaknesses": [
    {
      "fact": "the adverse fact",
      "source": "document identifier",
      "mitigationStrategy": "how to address or minimize this"
    }
  ],
  "documentsAnalyzed": ${docs.length},
  "executiveSummary": "2-3 sentence overall assessment of the case record"
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

    // Save to case_strategies table
    const { error: saveError } = await supabase
      .from('case_strategies')
      .upsert({
        case_id: caseId,
        user_id: user.id,
        analysis_type: 'cross_document',
        strengths: (analysis.strongestEvidence as Array<Record<string, unknown>> || []).map((e: Record<string, unknown>) => `${e.doc}: ${e.fact}`),
        weaknesses: (analysis.weaknesses as Array<Record<string, unknown>> || []).map((w: Record<string, unknown>) => `${w.source}: ${w.fact}`),
        recommended_actions: analysis.gaps,
        key_factors: analysis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'case_id,analysis_type' });

    if (saveError) console.error("Failed to save cross-document analysis:", saveError);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("cross-document-analysis error:", e);
    return createErrorResponse(e, 500, 'cross-document-analysis', corsHeaders);
  }
});
