import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { getFastAIProvider } from '../_shared/aiConfig.ts';

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

    try {
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: config.headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: "You are a legal research assistant helping attorneys analyze documents, case law, and legal issues. Provide clear, concise, and actionable analysis. Always cite relevant case law and statutes when applicable." },
            ...messages,
          ],
          max_tokens: config.maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI error:", response.status, t);
        let detail = "AI provider error";
        try { const j = JSON.parse(t); detail = j.error?.message || j.error || t; } catch { detail = t; }
        return new Response(JSON.stringify({ error: detail }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return createErrorResponse(new Error('AI provider timed out'), 504, 'chat', corsHeaders);
    }
    console.error("chat error:", e);
    return createErrorResponse(e, 500, 'chat', corsHeaders);
  }
});
