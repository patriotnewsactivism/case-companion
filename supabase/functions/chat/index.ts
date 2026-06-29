import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { getFastAIProvider, callChatCompletionWithFallback } from '../_shared/aiConfig.ts';

const TIMEOUT_MS = 15000;

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
    const config = getFastAIProvider();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const systemMessage = { role: "system", content: "You are a legal research assistant helping attorneys analyze documents, case law, and legal issues. Provide clear, concise, and actionable analysis. Always cite relevant case law and statutes when applicable." };

    try {
      // Try the primary provider first
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: config.headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [systemMessage, ...messages],
          max_tokens: config.maxTokens,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Primary failed — log and fall through to cascade fallback
      const t = await response.text();
      console.warn(`[chat] Primary provider (${config.provider}) returned ${response.status}, cascading:`, t);
      clearTimeout(timeoutId);

      // Fallback: try all providers via callChatCompletionWithFallback
      const { content } = await callChatCompletionWithFallback(
        [systemMessage, ...messages],
        { temperature: 0.7 }
      );

      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content }, finish_reason: "stop" } }],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (cascadeErr) {
      clearTimeout(timeoutId);
      if (cascadeErr instanceof DOMException && cascadeErr.name === 'AbortError') {
        return createErrorResponse(new Error('AI provider timed out'), 504, 'chat', corsHeaders);
      }
      console.error("[chat] All AI providers failed:", cascadeErr);
      return new Response(JSON.stringify({ error: "All AI providers exhausted. Please try again." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("chat error:", e);
    return createErrorResponse(e, 500, 'chat', corsHeaders);
  }
});
