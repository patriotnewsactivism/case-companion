/**
 * Shared AI provider configuration for all Supabase Edge Functions.
 *
 * Provider priority — free tiers first, paid API only as last resort so the
 * platform runs at $0 until there is revenue to justify paid models:
 *   0. AI_GATEWAY_URL     → Custom gateway            (override, if set)
 *   1. GOOGLE_AI_API_KEY  → Gemini flash (free tier)  (primary)
 *   2. GROQ_API_KEY       → Llama 3.3 70B (free tier, very fast)
 *   3. CEREBRAS_API_KEY   → Llama 3.3 70B (free tier, very fast)
 *   4. OPENROUTER_API_KEY → free open-weights models  (fallback, $0)
 *   5. OPENAI_API_KEY     → OPENAI_MODEL/gpt-4o-mini  (paid, last resort)
 *
 * Scaling cost up later requires no code change: set OPENAI_API_KEY (and
 * optionally OPENAI_MODEL) or attach billing to the Gemini key.
 *
 * callChatCompletion()             — calls a single provider, cycles Gemini models on 404/503
 * callChatCompletionWithFallback() — tries every configured provider in order until one succeeds
 */

export interface AIProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider: 'gemini' | 'groq' | 'cerebras' | 'openai' | 'openrouter' | 'gateway';
  headers: Record<string, string>;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallOptions {
  temperature?: number;
  responseFormat?: 'text' | 'json';
  systemPrompt?: string;
}

const GEMINI_OPENAI_COMPAT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// Newest/smartest first; callChatCompletion cycles to the next entry when a
// model is unavailable to this key (404/403/503), so preview IDs are safe.
// All of these have Gemini API free tiers — flash models carry the highest
// free request quotas, which is why they lead.
export const GEMINI_MODEL_PREFERENCE: readonly string[] = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

// Billing / auth errors — skip this provider entirely and cascade to the next one.
// 403 is NOT included: Gemini returns 403 for models a free-tier key can't
// access, which should fall through to the next model, not abort the provider.
const BILLING_ERROR_STATUSES = new Set([401, 402]);

// Model unavailable within the same provider — try next model in preference list.
const MODEL_UNAVAILABLE_STATUSES = new Set([403, 404, 503]);

/** Free, fast open-weights providers (OpenAI-compatible endpoints). */
function getGroqConfig(): AIProviderConfig | null {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return null;
  return {
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: key,
    model: Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile',
    provider: 'groq',
    maxTokens: 8192,
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

function getCerebrasConfig(): AIProviderConfig | null {
  const key = Deno.env.get('CEREBRAS_API_KEY');
  if (!key) return null;
  return {
    apiUrl: 'https://api.cerebras.ai/v1/chat/completions',
    apiKey: key,
    model: Deno.env.get('CEREBRAS_MODEL') || 'llama-3.3-70b',
    provider: 'cerebras',
    maxTokens: 8192,
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

export function getAIProvider(): AIProviderConfig {
  const GOOGLE_AI_API_KEY  = Deno.env.get('GOOGLE_AI_API_KEY');
  const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY');
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  const AI_GATEWAY_URL     = Deno.env.get('AI_GATEWAY_URL');
  const AI_GATEWAY_MODEL   = Deno.env.get('AI_GATEWAY_MODEL');

  if (AI_GATEWAY_URL) {
    const key = OPENAI_API_KEY || OPENROUTER_API_KEY || GOOGLE_AI_API_KEY || '';
    return {
      apiUrl: AI_GATEWAY_URL,
      apiKey: key,
      model: AI_GATEWAY_MODEL || 'gemini-2.5-pro',
      provider: 'gateway',
      maxTokens: 8192,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    };
  }

  if (GOOGLE_AI_API_KEY) {
    return {
      apiUrl: GEMINI_OPENAI_COMPAT,
      apiKey: GOOGLE_AI_API_KEY,
      model: GEMINI_MODEL_PREFERENCE[0],
      provider: 'gemini',
      maxTokens: 8192,
      headers: {
        'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // Free tier before paid: Groq/Cerebras/OpenRouter cost $0, so they outrank
  // the paid OpenAI fallback until there are paying customers.
  const groq = getGroqConfig();
  if (groq) return groq;

  const cerebras = getCerebrasConfig();
  if (cerebras) return cerebras;

  if (OPENROUTER_API_KEY) {
    const model = Deno.env.get('OPENROUTER_MODEL') || AI_GATEWAY_MODEL || 'openai/gpt-oss-120b:free';
    return {
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model,
      provider: 'openrouter',
      maxTokens: 4096,
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    };
  }

  if (OPENAI_API_KEY) {
    return {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: OPENAI_API_KEY,
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      provider: 'openai',
      maxTokens: 4096,
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
  }

  throw new Error(
    '[aiConfig] No AI API key configured. Set at least one of: GOOGLE_AI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY'
  );
}

/**
 * Returns ALL configured AI providers in priority order.
 * Used by callChatCompletionWithFallback to cascade across providers.
 */
export function getAllAIProviders(): AIProviderConfig[] {
  const GOOGLE_AI_API_KEY  = Deno.env.get('GOOGLE_AI_API_KEY');
  const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY');
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  const AI_GATEWAY_URL     = Deno.env.get('AI_GATEWAY_URL');
  const AI_GATEWAY_MODEL   = Deno.env.get('AI_GATEWAY_MODEL');

  const providers: AIProviderConfig[] = [];

  if (AI_GATEWAY_URL) {
    const key = OPENAI_API_KEY || OPENROUTER_API_KEY || GOOGLE_AI_API_KEY || '';
    providers.push({
      apiUrl: AI_GATEWAY_URL,
      apiKey: key,
      model: AI_GATEWAY_MODEL || 'gemini-2.5-pro',
      provider: 'gateway',
      maxTokens: 8192,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    });
  }

  if (GOOGLE_AI_API_KEY) {
    providers.push({
      apiUrl: GEMINI_OPENAI_COMPAT,
      apiKey: GOOGLE_AI_API_KEY,
      model: GEMINI_MODEL_PREFERENCE[0],
      provider: 'gemini',
      maxTokens: 8192,
      headers: {
        'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Free tier before paid: Groq/Cerebras/OpenRouter cost $0, so they outrank
  // the paid OpenAI fallback until there are paying customers.
  const groq = getGroqConfig();
  if (groq) providers.push(groq);

  const cerebras = getCerebrasConfig();
  if (cerebras) providers.push(cerebras);

  if (OPENROUTER_API_KEY) {
    const model = Deno.env.get('OPENROUTER_MODEL') || AI_GATEWAY_MODEL || 'openai/gpt-oss-120b:free';
    providers.push({
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model,
      provider: 'openrouter',
      maxTokens: 4096,
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    });
  }

  if (OPENAI_API_KEY) {
    providers.push({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: OPENAI_API_KEY,
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      provider: 'openai',
      maxTokens: 4096,
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  if (providers.length === 0) {
    throw new Error(
      '[aiConfig] No AI API key configured. Set at least one of: GOOGLE_AI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY'
    );
  }

  return providers;
}

/** Provider for heavy document analysis — largest Gemini model + max output budget. */
export function getDocumentAIProvider(): AIProviderConfig {
  const base = getAIProvider();
  if (base.provider === 'gemini') return { ...base, model: GEMINI_MODEL_PREFERENCE[0], maxTokens: 16384 };
  return { ...base, maxTokens: 8192 };
}

/** Fast provider for low-latency tasks (coaching tips, objection detection). */
export function getFastAIProvider(): AIProviderConfig {
  const base = getAIProvider();
  if (base.provider === 'gemini') return { ...base, model: 'gemini-2.5-flash', maxTokens: 4096 };
  return { ...base, maxTokens: 2048 };
}

/**
 * Calls any OpenAI-compatible /chat/completions endpoint.
 *
 * For Gemini providers: cycles through GEMINI_MODEL_PREFERENCE on 404/503 (model unavailable).
 * On billing/auth errors (401/402/403): throws immediately so the caller can cascade providers.
 */
export async function callChatCompletion(
  config: AIProviderConfig,
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<string> {
  const { temperature = 0.7, responseFormat = 'text', systemPrompt } = options;

  const fullMessages: ChatMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const modelsToTry =
    config.provider === 'gemini' ? [...GEMINI_MODEL_PREFERENCE] : [config.model];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const body: Record<string, unknown> = {
      model,
      messages: fullMessages,
      temperature,
      max_tokens: config.maxTokens,
    };
    if (responseFormat === 'json') body.response_format = { type: 'json_object' };

    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);

      // Billing / auth failure — throw so callChatCompletionWithFallback cascades to next provider
      if (BILLING_ERROR_STATUSES.has(res.status)) {
        throw new Error(`AI provider billing/auth error ${res.status} (${config.provider}): ${errText}`);
      }

      // Model unavailable — try next model in Gemini preference list
      if (MODEL_UNAVAILABLE_STATUSES.has(res.status) && config.provider === 'gemini') {
        lastError = new Error(`Gemini model ${model} unavailable (${res.status})`);
        console.warn(`[aiConfig] ${lastError.message} — trying next model`);
        continue;
      }

      throw new Error(`AI API error ${res.status}: ${errText}`);
    }

    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (json.error?.message) throw new Error(`AI provider error: ${json.error.message}`);
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned empty response');
    return content;
  }

  throw lastError ?? new Error('All AI models exhausted without a response');
}

/**
 * Tries every configured AI provider in priority order until one succeeds.
 *
 * Use this for any feature where you want automatic cross-provider failover:
 * Gemini billing fails → OpenAI → OpenRouter, all transparently.
 *
 * Returns { content, provider } so callers can log which provider was used.
 */
export async function callChatCompletionWithFallback(
  messages: ChatMessage[],
  options: CallOptions = {}
): Promise<{ content: string; provider: string }> {
  const providers = getAllAIProviders();
  const errors: string[] = [];

  for (const config of providers) {
    try {
      const content = await callChatCompletion(config, messages, options);
      console.log(`[aiConfig] callChatCompletionWithFallback: succeeded with provider=${config.provider}`);
      return { content, provider: config.provider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${config.provider}: ${msg}`);
      console.warn(`[aiConfig] Provider ${config.provider} failed, trying next. Error: ${msg}`);
    }
  }

  throw new Error(`All AI providers exhausted. Errors: ${errors.join(' | ')}`);
}
