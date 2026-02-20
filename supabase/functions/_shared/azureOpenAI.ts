/**
 * Azure OpenAI integration utilities for edge functions
 */

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AzureOpenAIResponse {
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

interface AzureOpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }>;
}

const DEFAULT_API_VERSION = '2024-02-15-preview';

function getConfig(): AzureOpenAIConfig {
  const apiKey = Deno.env.get('AZURE_OPENAI_API_KEY');
  const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const deploymentName = Deno.env.get('AZURE_OPENAI_DEPLOYMENT_NAME');
  const apiVersion = Deno.env.get('AZURE_OPENAI_API_VERSION') || DEFAULT_API_VERSION;

  if (!apiKey || !endpoint || !deploymentName) {
    throw new Error(
      'Missing Azure OpenAI configuration. Required environment variables: ' +
      'AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME'
    );
  }

  return { apiKey, endpoint, deploymentName, apiVersion };
}

function buildUrl(config: AzureOpenAIConfig): string {
  const { endpoint, deploymentName, apiVersion } = config;
  const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  return `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
}

/**
 * Calls the Azure OpenAI Chat Completions API with the provided messages.
 * 
 * @param messages - Array of chat messages with role and content
 * @param options - Optional configuration for temperature, maxTokens, and jsonMode
 * @returns The content string from the assistant's response
 * @throws Error if the API call fails or returns an error response
 * 
 * @example
 * ```typescript
 * const response = await callAzureOpenAI([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ], { temperature: 0.7, maxTokens: 100 });
 * console.log(response);
 * ```
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
  const url = buildUrl(config);

  const requestBody: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1000,
  };

  if (options?.jsonMode) {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Azure OpenAI API error (${response.status})`;
    
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

  const data: AzureOpenAIResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Azure OpenAI returned no choices in response');
  }

  const content = data.choices[0].message?.content;
  if (content === undefined || content === null) {
    throw new Error('Azure OpenAI returned empty content');
  }

  return content;
}

/**
 * Gets structured JSON output from Azure OpenAI by parsing the response as JSON.
 * 
 * @typeParam T - The expected type of the parsed JSON response
 * @param systemPrompt - The system prompt to guide the model's behavior
 * @param userPrompt - The user prompt with the specific request
 * @param schemaDescription - Optional JSON schema description to include in the system prompt
 * @returns The parsed JSON object of type T
 * @throws Error if the response cannot be parsed as valid JSON
 * 
 * @example
 * ```typescript
 * interface AnalysisResult {
 *   summary: string;
 *   keyPoints: string[];
 * }
 * 
 * const result = await getStructuredOutput<AnalysisResult>(
 *   'You are a text analyzer.',
 *   'Analyze this text: ...',
 *   '{ summary: string, keyPoints: string[] }'
 * );
 * console.log(result.summary);
 * ```
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
      `Failed to parse JSON response from Azure OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}. Response: ${response.substring(0, 200)}`
    );
  }
}

/**
 * Streams responses from Azure OpenAI, calling the provided callback for each chunk.
 * 
 * @param messages - Array of chat messages with role and content
 * @param onChunk - Callback function called for each streamed chunk of content
 * @param options - Optional configuration for temperature and maxTokens
 * @throws Error if the API call fails or returns an error response
 * 
 * @example
 * ```typescript
 * await streamAzureOpenAI(
 *   [{ role: 'user', content: 'Tell me a story' }],
 *   (chunk) => console.print(chunk),
 *   { temperature: 0.8 }
 * );
 * ```
 */
export async function streamAzureOpenAI(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  const config = getConfig();
  const url = buildUrl(config);

  const requestBody: Record<string, unknown> = {
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1000,
    stream: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Azure OpenAI API error (${response.status})`;
    
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
            const chunk: AzureOpenAIStreamChunk = JSON.parse(jsonStr);
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
