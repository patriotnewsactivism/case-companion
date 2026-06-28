import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { getFastAIProvider, callChatCompletion } from '../_shared/aiConfig.ts';

const SYSTEM_PROMPT = "You are a legal research assistant helping attorneys analyze documents, case law, and legal issues. Provide clear, concise, and actionable analysis. Always cite relevant case law and statutes when applicable.";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(new Error(authResult.error || 'Unauthorized'), 401, 'chat', corsHeaders);
    }

    const { user } = authResult;

    const rateLimitCheck = checkRateLimit(`chat:${user.id}`, 60, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: new Date(rateLimitCheck.resetAt).toISOString() }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = await req.json();

    let config;
    try {
      config = getFastAIProvider();
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI not configured. Please set GOOGLE_AI_API_KEY in your Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const content = await callChatCompletion(
        config,
        messages,
        { systemPrompt: SYSTEM_PROMPT, temperature: 0.7 }
      );
      return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (aiErr) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error("chat AI error:", errMsg);
      if (errMsg.includes('rate limit') || errMsg.includes('429')) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `AI error: ${errMsg}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("chat error:", e);
    return createErrorResponse(e, 500, 'chat', corsHeaders);
  }
});
