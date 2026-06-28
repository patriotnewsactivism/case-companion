/**
 * Shared AI provider configuration for all Supabase Edge Functions.
 *
 * Provider priority:
 *   1. GOOGLE_AI_API_KEY  → Gemini 2.5 Pro  (primary)
 *   2. OPENAI_API_KEY     → GPT-4o           (fallback)
 *   3. OPENROUTER_API_KEY → OpenRouter       (last resort)
 *   0. AI_GATEWAY_URL     → Custom gateway   (override)
 */

export interface AIProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider: 'gemini' | 'openai' | 'openrouter' | 'gateway';
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

export const GEMINI_MODEL_PREFERENCE: readonly string[] = [
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-pro',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro-latest',
];

export function getAIProvider(): AIProviderConfig {
  const GOOGLE_AI_API_KEY  = Deno.env.get('GOOGLE_AI_API_KEY');
  const OPENAI_API_KEY     = Deno.env.get('OPENAI_API_KEY');
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  const AI_GATEWAY_URL     = Deno.env.get('AI_GATEWAY_URL');
  const AI_GATEWAY_MODEL   = Deno.env.get('AI_GATEWAY_MODEL');

  if (AI_GATEWAY_URL) {
    const key = OPENAI_API_KEY || OPENROUTER_API_KEY || GOOGLE_AI_API_KEY || '';
    return { apiUrl: AI_GATEWAY_URL, apiKey: key, model: AI_GATEWAY_MODEL || 'gemini-2.5-pro', provider: 'gateway', maxTokens: 8192, headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://casebuddy.live', 'X-Title': 'CaseBuddy Legal AI' } };
  }

  if (GOOGLE_AI_API_KEY) {
    return { apiUrl: GEMINI_OPENAI_COMPAT, apiKey: GOOGLE_AI_API_KEY, model: GEMINI_MODEL_PREFERENCE[0], provider: 'gemini', maxTokens: 8192, headers: { 'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`, 'Content-Type': 'application/json' } };
  }

  if (OPENAI_API_KEY) {
    return { apiUrl: 'https://api.openai.com/v1/chat/completions', apiKey: OPENAI_API_KEY, model: 'gpt-4o', provider: 'openai', maxTokens: 4096, headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' } };
  }

  if (OPENROUTER_API_KEY) {
    return { apiUrl: 'https://openrouter.ai/api/v1/chat/completions', apiKey: OPENROUTER_API_KEY, model: AI_GATEWAY_MODEL || 'google/gemini-2.5-pro:free', provider: 'openrouter', maxTokens: 4096, headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://casebuddy.live', 'X-Title': 'CaseBuddy Legal AI' } };
  }

  throw new Error('[aiConfig] No AI API key configured. Set GOOGLE_AI_API_KEY via: npx supabase secrets set GOOGLE_AI_API_KEY=<key>');
}

/** Provider for heavy document analysis — forces largest Gemini model + max output budget. */
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
 * For Gemini providers, automatically cycles through GEMINI_MODEL_PREFERENCE
 * on 404/503 to ensure resilience against model unavailability.
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
      if ((res.status === 404 || res.status === 429 || res.status === 503) && config.provider === 'gemini') {
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
