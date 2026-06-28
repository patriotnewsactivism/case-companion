import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { getFastAIProvider, callChatCompletion } from '../_shared/aiConfig.ts';

// Score document relevance to a query using keyword overlap
function scoreDocumentRelevance(doc: Record<string, unknown>, query: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return 1;
  const docText = [
    doc.name,
    doc.summary,
    ...(Array.isArray(doc.key_facts) ? doc.key_facts : []),
    ...(Array.isArray(doc.favorable_findings) ? doc.favorable_findings : []),
    ...(Array.isArray(doc.adverse_findings) ? doc.adverse_findings : []),
  ].join(' ').toLowerCase();
  const matches = queryWords.filter(word => docText.includes(word)).length;
  return matches / queryWords.length;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'document-aware-chat',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const rateLimitCheck = checkRateLimit(`document-aware-chat:${user.id}`, 60, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, caseId } = await req.json();
    if (!messages || !caseId) {
      return new Response(JSON.stringify({ error: 'messages and caseId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch case data
    const { data: caseData } = await supabase
      .from('cases')
      .select('name, case_type, client_name, representation, case_theory, key_issues, winning_factors')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch analyzed documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, bates_number, summary, key_facts, favorable_findings, adverse_findings, ocr_text, ai_analyzed')
      .eq('case_id', caseId)
      .order('bates_number', { ascending: true, nullsFirst: false });

    const analyzedDocs = (documents || []).filter((d: Record<string, unknown>) => d.ai_analyzed || d.ocr_text || d.summary);

    // Get the last user message for relevance scoring
    const lastUserMessage = [...messages].reverse().find((m: Record<string, unknown>) => m.role === 'user')?.content as string || '';

    // Score and sort documents by relevance to query
    const scoredDocs = analyzedDocs
      .map((doc: Record<string, unknown>) => ({
        doc,
        score: scoreDocumentRelevance(doc, lastUserMessage),
      }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    // Build context: top 12 docs, include OCR text only for highly relevant ones
    const MAX_DOCS = 12;
    const MAX_OCR_CHARS = 2000;
    const docContext = scoredDocs.slice(0, MAX_DOCS).map(({ doc, score }: { doc: Record<string, unknown>; score: number }) => {
      const bates = doc.bates_number || doc.name;
      const parts: string[] = [`[${bates}]`];
      if (doc.summary) parts.push(`Summary: ${doc.summary}`);
      if (Array.isArray(doc.key_facts) && doc.key_facts.length) {
        parts.push(`Key Facts: ${doc.key_facts.join('; ')}`);
      }
      if (Array.isArray(doc.favorable_findings) && doc.favorable_findings.length) {
        parts.push(`Favorable to client: ${doc.favorable_findings.join('; ')}`);
      }
      if (Array.isArray(doc.adverse_findings) && doc.adverse_findings.length) {
        parts.push(`Adverse to client: ${doc.adverse_findings.join('; ')}`);
      }
      // Include OCR excerpt for highly relevant documents
      if (score > 0.3 && doc.ocr_text) {
        parts.push(`Full text excerpt: ${(doc.ocr_text as string).slice(0, MAX_OCR_CHARS)}`);
      }
      return parts.join('\n');
    }).join('\n\n---\n\n');

    const caseMetadata = [
      `Case: ${caseData.name}`,
      `Type: ${caseData.case_type}`,
      `Client: ${caseData.client_name} (${caseData.representation})`,
      caseData.case_theory ? `Theory: ${caseData.case_theory}` : null,
      caseData.key_issues?.length ? `Key Issues: ${caseData.key_issues.join(', ')}` : null,
      caseData.winning_factors?.length ? `Winning Factors: ${caseData.winning_factors.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const documentCount = analyzedDocs.length;
    const systemPrompt = `You are a legal AI assistant for the case: "${caseData.name}".
You have access to ${documentCount} analyzed case document${documentCount !== 1 ? 's' : ''}.

CASE INFORMATION:
${caseMetadata}

CASE DOCUMENTS (${documentCount} total, most relevant shown):
${docContext || 'No analyzed documents available yet.'}

INSTRUCTIONS:
- When referencing specific facts from documents, cite by Bates number or document name in brackets, e.g. [DOC-001] or [Smith Deposition]
- If asked about a specific person, date, or event, search the documents and quote the relevant passage
- Distinguish clearly between facts favorable and adverse to the client
- If information is not found in the documents, say so explicitly — do not speculate
- Format responses clearly with headers when appropriate
- Keep legal advice accurate and grounded in the provided facts`;

    // AI provider via shared config — callChatCompletion handles model fallback automatically
    let config;
    try {
      config = getFastAIProvider();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'AI not configured. Please set GOOGLE_AI_API_KEY in your Supabase secrets: npx supabase secrets set GOOGLE_AI_API_KEY=<your-key>',
          _documentCount: documentCount,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let assistantContent: string;
    try {
      assistantContent = await callChatCompletion(
        config,
        messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        { systemPrompt, temperature: 0.7 }
      );
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error('AI chat completion failed:', errMsg);
      if (errMsg.includes('rate limit') || errMsg.includes('429')) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.', _documentCount: documentCount }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI error: ${errMsg}`, _documentCount: documentCount }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return in OpenAI-compatible format so the frontend can read choices[0].message.content
    return new Response(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: assistantContent } }],
        _documentCount: documentCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("document-aware-chat error:", e);
    return createErrorResponse(e, 500, 'document-aware-chat', corsHeaders);
  }
});
