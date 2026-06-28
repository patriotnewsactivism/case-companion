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

    // Fetch key documents for evidence references
    const { data: documents } = await supabase
      .from('documents')
      .select('name, bates_number, summary, key_facts, favorable_findings')
      .eq('case_id', caseId)
      .eq('ai_analyzed', true)
      .order('created_at', { ascending: false })
      .limit(10);

    const docContext = (documents || []).map((d: Record<string, unknown>) => {
      const parts: string[] = [`[${d.bates_number || d.name}]`];
      if (d.summary) parts.push(d.summary as string);
      if (Array.isArray(d.key_facts) && d.key_facts.length) {
        parts.push((d.key_facts as string[]).slice(0, 2).join('; '));
      }
      return parts.join(': ');
    }).join('\n');

    const recentConversation = Array.isArray(recentHistory)
      ? (recentHistory as Array<{ role: string; content: string }>)
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'Attorney' : 'Witness/Opponent'}: ${m.content}`)
          .join('\n')
      : '';

    const prompt = `You are a real-time trial advocacy coach watching a ${mode || 'trial'} practice session.

LAST EXCHANGE:
Attorney asked: "${lastQuestion}"
Witness/Opponent answered: "${lastAnswer || '(no answer yet)'}"

RECENT CONVERSATION:
${recentConversation || 'Beginning of session'}

CASE DOCUMENTS:
${docContext || 'No documents available'}

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

    // AI provider via shared config
    let config;
    try {
      config = getFastAIProvider();
    } catch {
      // Graceful degradation: return empty coaching when no AI provider configured
      return new Response(JSON.stringify({
        objectionAlert: { isObjectionable: false, objectionType: null, grounds: null },
        answerAnalysis: { isEvasive: false, evasionTactic: null, trapAlert: null },
        suggestedFollowUps: [],
        evidenceReference: { relevantDoc: null, howToUse: null },
        coachingNote: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: config.headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: config.maxTokens,
        temperature: 0.7,
      }),
    });
    clearTimeout(timeoutId);

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
