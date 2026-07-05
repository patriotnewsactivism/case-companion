import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { getFastAIProvider } from '../_shared/aiConfig.ts';

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

    // Fetch all analyzed documents — CaseBuddy-analyzed (ai_analyzed) OR
    // DiscoveryLens-analyzed (analysis JSONB from the shared documents table)
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, bates_number, bates_formatted, summary, key_facts, favorable_findings, adverse_findings, analysis, status, ai_analyzed, created_at')
      .eq('case_id', caseId)
      .or('ai_analyzed.eq.true,analysis.not.is.null')
      .order('bates_number', { ascending: true, nullsFirst: false })
      .limit(40);

    const docs = documents || [];
    if (docs.length < 2) {
      return new Response(JSON.stringify({
        error: 'At least 2 analyzed documents are required for cross-document analysis.',
        documentsAnalyzed: docs.length,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build document summaries for AI (using already-extracted fields only — no OCR bulk).
    // Falls back to DiscoveryLens `analysis` JSON fields when CaseBuddy columns are empty.
    const docSummaries = docs.slice(0, 30).map((d: Record<string, unknown>) => {
      const dl = (d.analysis && typeof d.analysis === 'object' && !Array.isArray(d.analysis))
        ? d.analysis as { summary?: string; relevantFacts?: string[]; evidenceType?: string }
        : null;
      const parts: string[] = [`DOCUMENT: ${d.bates_number || d.bates_formatted || d.name}`];
      const summary = (typeof d.summary === 'string' && d.summary) || dl?.summary;
      if (summary) parts.push(`Summary: ${summary}`);
      if (dl?.evidenceType) parts.push(`Evidence Type: ${dl.evidenceType}`);
      const keyFacts = (Array.isArray(d.key_facts) && d.key_facts.length)
        ? d.key_facts
        : (Array.isArray(dl?.relevantFacts) ? dl.relevantFacts : []);
      if (keyFacts.length) parts.push(`Key Facts: ${keyFacts.join('; ')}`);
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

    // AI provider selection via shared config
    const config = getFastAIProvider();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: config.headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: systemPrompt }],
        max_tokens: config.maxTokens,
        temperature: 0.7,
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI analysis failed (${response.status}): ${t.slice(0, 200)}` }), {
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
