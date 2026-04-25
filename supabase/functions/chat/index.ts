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
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'chat',
        corsHeaders
      );
    }

    const { user } = authResult;

    const rateLimitCheck = checkRateLimit(`chat:${user.id}`, 30, 60000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { messages } = await req.json();

    // Determine AI provider: prefer custom gateway, then Google Gemini, then OpenAI
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (AI_GATEWAY_URL) {
      apiUrl = AI_GATEWAY_URL;
      apiKey = OPENAI_API_KEY || GOOGLE_AI_API_KEY || "";
      model = "gpt-4o-mini";
    } else if (GOOGLE_AI_API_KEY) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = GOOGLE_AI_API_KEY;
      model = "gemini-2.0-flash";
    } else if (OPENAI_API_KEY) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = OPENAI_API_KEY;
      model = "gpt-4o-mini";
    } else {
      return new Response(JSON.stringify({ error: "No AI API key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a legal research assistant helping attorneys analyze documents, case law, and legal issues. Provide clear, concise, and actionable analysis. Always cite relevant case law and statutes when applicable." },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return createErrorResponse(e, 500, 'chat', corsHeaders);
  }
});
