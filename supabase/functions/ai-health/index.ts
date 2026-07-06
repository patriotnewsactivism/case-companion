/**
 * ai-health — diagnostic endpoint that live-tests every configured AI provider
 * with a minimal request and reports which ones actually work.
 *
 * Auth: requires the HEALTH_CHECK_KEY secret via the `x-health-key` header
 * (verify_jwt is disabled for this function so it can be called from CI/CLI).
 *
 *   curl -H "x-health-key: <key>" https://<ref>.supabase.co/functions/v1/ai-health
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAllAIProviders, callChatCompletion } from "../_shared/aiConfig.ts";

interface ProviderStatus {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function testChatProvider(
  config: ReturnType<typeof getAllAIProviders>[number],
): Promise<ProviderStatus> {
  const started = Date.now();
  try {
    const content = await callChatCompletion(
      config,
      [{ role: "user", content: "Reply with the single word: OK" }],
      { temperature: 0 },
    );
    return {
      provider: config.provider,
      model: config.model,
      ok: content.length > 0,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      provider: config.provider,
      model: config.model,
      ok: false,
      latencyMs: Date.now() - started,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    };
  }
}

async function testCohere(): Promise<ProviderStatus | null> {
  const key = Deno.env.get("COHERE_API_KEY");
  if (!key) return null;
  const started = Date.now();
  try {
    const res = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Client-Name": "case-companion-health",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 10,
      }),
    });
    const body = await res.text();
    return {
      provider: "cohere",
      model: "command-a-03-2025",
      ok: res.ok,
      latencyMs: Date.now() - started,
      error: res.ok ? undefined : `${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      provider: "cohere",
      model: "command-a-03-2025",
      ok: false,
      latencyMs: Date.now() - started,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    };
  }
}

// 1x1 white PNG for a minimal Vision API round-trip
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function testGoogleVision(): Promise<ProviderStatus | null> {
  const apiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
  const creds = Deno.env.get("GOOGLE_CLOUD_VISION_CREDENTIALS");
  if (!apiKey && !creds) return null;

  const started = Date.now();
  try {
    // API-key path only for the health check (service-account path is
    // exercised by the OCR pipeline itself)
    if (!apiKey) {
      return {
        provider: "google-vision",
        model: "DOCUMENT_TEXT_DETECTION",
        ok: !!creds && creds.trim().length > 10,
        error: creds && creds.trim().length > 10
          ? undefined
          : "GOOGLE_CLOUD_VISION_CREDENTIALS is set but empty",
      };
    }
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: TINY_PNG },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        }],
      }),
    });
    const body = await res.text();
    return {
      provider: "google-vision",
      model: "DOCUMENT_TEXT_DETECTION (api-key)",
      ok: res.ok,
      latencyMs: Date.now() - started,
      error: res.ok ? undefined : `${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      provider: "google-vision",
      model: "DOCUMENT_TEXT_DETECTION",
      ok: false,
      latencyMs: Date.now() - started,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    };
  }
}

serve(async (req) => {
  const expected = Deno.env.get("HEALTH_CHECK_KEY");
  if (!expected || req.headers.get("x-health-key") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let chatConfigs: ReturnType<typeof getAllAIProviders> = [];
  let configError: string | null = null;
  try {
    chatConfigs = getAllAIProviders();
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }

  const results = await Promise.all([
    ...chatConfigs.map(testChatProvider),
    testCohere(),
    testGoogleVision(),
  ]);

  const statuses = results.filter((r): r is ProviderStatus => r !== null);

  // Presence-only checks (no quota burned)
  const presence = {
    ocr_space: !!Deno.env.get("OCR_SPACE_API_KEY"),
    assemblyai: !!Deno.env.get("ASSEMBLYAI_API_KEY"),
    deepgram: !!Deno.env.get("DEEPGRAM_API_KEY"),
    gemini_backup_key: !!Deno.env.get("GEMINI_API_KEY"),
  };

  return new Response(JSON.stringify({
    checkedAt: new Date().toISOString(),
    configError,
    providers: statuses,
    configuredOnly: presence,
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
