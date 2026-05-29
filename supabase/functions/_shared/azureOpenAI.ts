/**
 * OpenRouter / Gemini AI integration utilities for edge functions
 * (Replaces Azure OpenAI — uses free models via OpenRouter or Google Gemini)
 */

export interface AzureOpenAIConfig {
  provider: 'openrouter' | 'gemini' | 'none';
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getConfig(): AzureOpenAIConfig {
  // Priority: OpenRouter → Google Gemini (via OpenAI-compat endpoint) → legacy Azure (skip)
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const googleKey = Deno.env.get('GOOGLE_AI_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      model: Deno.env.get('AI_GATEWAY_MODEL') || 'openai/gpt-oss-120b:free',
    };
  }

  if (googleKey) {
    return {
      provider: 'gemini',
      apiKey: googleKey,
      model: 'gemini-2.0-flash',
    };
  }

  if (openaiKey) {
    return {
      provider: 'openrouter',
      apiKey: openaiKey,
      model: 'gpt-4o-mini',
    };
  }

  throw new Error(
    'No AI API key configured. Set one of: OPENROUTER_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY'
  );
}

function getApiUrl(config: AzureOpenAIConfig): string {
  switch (config.provider) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    default:
      return 'https://openrouter.ai/api/v1/chat/completions';
  }
}

/**
 * Calls an AI chat completions API with the provided messages.
 * Uses OpenRouter (free models) or Google Gemini as providers.
 * Maintains the same interface as the old Azure OpenAI function.
 */
export async function callAzureOpenAI(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const config = getConfig();

  // For Gemini native API (better for JSON mode)
  if (config.provider === 'gemini' && options?.jsonMode) {
    return callGeminiNative(messages, config.apiKey, options);
  }

  const apiUrl = getApiUrl(config);

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1000,
  };

  if (options?.jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://casebuddy.live';
    headers['X-Title'] = 'CaseBuddy Legal AI';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `AI API error (${response.status})`;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = `${errorMessage}: ${errorText}`;
      }
    }

    throw new Error(errorMessage);
  }

  const data: OpenAICompatibleResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('AI API returned no choices in response');
  }

  const content = data.choices[0].message?.content;
  if (content === undefined || content === null) {
    throw new Error('AI API returned empty content');
  }

  return content;
}

/**
 * Call Gemini native API directly (better JSON support)
 */
async function callGeminiNative(
  messages: ChatMessage[],
  apiKey: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    contents: userMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 1000,
    },
  };

  if (systemMsg) {
    body.system_instruction = { parts: [{ text: systemMsg.content }] };
  }

  if (options?.jsonMode) {
    (body.generationConfig as Record<string, unknown>).responseMimeType = 'application/json';
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty content');
  }

  return text;
}

/**
 * Gets structured JSON output by parsing the response as JSON.
 */
export async function getStructuredOutput<T>(
  systemPrompt: string,
  userPrompt: string,
  schemaDescription?: string
): Promise<T> {
  let fullSystemPrompt = systemPrompt;

  if (schemaDescription) {
    fullSystemPrompt += `\n\nRespond with valid JSON matching this schema:\n${schemaDescription}`;
  } else {
    fullSystemPrompt += '\n\nRespond with valid JSON only.';
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callAzureOpenAI(messages, {
    jsonMode: true,
    temperature: 0.3,
  });

  try {
    return JSON.parse(response) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}. Response: ${response.substring(0, 200)}`
    );
  }
}

/**
 * Streams responses from AI, calling the provided callback for each chunk.
 */
export async function streamAzureOpenAI(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  const config = getConfig();
  const apiUrl = getApiUrl(config);

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1000,
    stream: true,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://casebuddy.live';
    headers['X-Title'] = 'CaseBuddy Legal AI';
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI streaming error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

        if (trimmedLine.startsWith('data: ')) {
          const jsonStr = trimmedLine.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
