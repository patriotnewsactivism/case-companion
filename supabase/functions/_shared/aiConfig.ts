/**
 * Shared AI provider configuration for all edge functions.
 * Centralizes provider selection: OpenRouter (free) → Gemini → OpenAI
 */

export interface AIProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  provider: string;
  headers: Record<string, string>;
}

/**
 * Get the best available AI provider configuration.
 * Priority: AI_GATEWAY_URL → GOOGLE_AI_API_KEY (Gemini) → OPENAI_API_KEY → OPENROUTER (free)
 */
export function getAIProvider(): AIProviderConfig {
  const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  const AI_GATEWAY_MODEL = Deno.env.get('AI_GATEWAY_MODEL');

  // 1) Custom gateway (OpenRouter, LiteLLM, etc.)
  if (AI_GATEWAY_URL) {
    const key = OPENAI_API_KEY || OPENROUTER_API_KEY || GOOGLE_AI_API_KEY || '';
    const model = AI_GATEWAY_MODEL || 'openai/gpt-oss-120b:free';
    return {
      apiUrl: AI_GATEWAY_URL,
      apiKey: key,
      model,
      provider: 'gateway',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    };
  }

  // 2) Google Gemini (free tier)
  if (GOOGLE_AI_API_KEY) {
    return {
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: GOOGLE_AI_API_KEY,
      model: 'gemini-2.0-flash',
      provider: 'gemini',
      headers: {
        'Authorization': `Bearer ${GOOGLE_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // 3) OpenRouter with dedicated key (free models)
  if (OPENROUTER_API_KEY) {
    return {
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: OPENROUTER_API_KEY,
      model: AI_GATEWAY_MODEL || 'openai/gpt-oss-120b:free',
      provider: 'openrouter',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://casebuddy.live',
        'X-Title': 'CaseBuddy Legal AI',
      },
    };
  }

  // 4) OpenAI direct
  if (OPENAI_API_KEY) {
    return {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      provider: 'openai',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
  }

  throw new Error('No AI API key configured. Set AI_GATEWAY_URL, GOOGLE_AI_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY');
}
