import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders, createErrorResponse } from '../_shared/errorHandler.ts'
import { callChatCompletionWithFallback, type ChatMessage } from '../_shared/aiConfig.ts'

/**
 * Gemini proxy — accepts native Gemini format (contents/system_instruction/generationConfig)
 * and forwards to the best available AI provider.
 *
 * Provider cascade: Gemini (x-goog-api-key header) → OpenAI → OpenRouter
 * If all providers fail, returns the error.
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { model = Deno.env.get('GOOGLE_AI_MODEL') || 'gemini-2.0-flash', contents, system_instruction, generationConfig } = await req.json()

    // Try Gemini native API first (if key is set) using x-goog-api-key header
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY')

    if (googleApiKey) {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': googleApiKey,
        },
        body: JSON.stringify({
          contents,
          system_instruction,
          generationConfig,
        }),
      })

      // If Gemini succeeds, return native Gemini format response
      if (response.ok) {
        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // If 403 (billing) or 429 (rate limit), fall through to OpenRouter
      const errText = await response.text().catch(() => '')
      console.warn(`[gemini-proxy] Gemini returned ${response.status}, falling back to OpenRouter:`, errText)
    }

    // Fallback: Convert Gemini format → OpenAI chat format and use callChatCompletionWithFallback
    // Extract the last user message from contents
    const messages: ChatMessage[] = []

    if (system_instruction?.parts?.[0]?.text) {
      messages.push({ role: 'system', content: system_instruction.parts[0].text })
    }

    if (Array.isArray(contents)) {
      for (const block of contents) {
        const text = block?.parts?.map((p: { text?: string }) => p?.text || '').join('') || ''
        if (text) {
          messages.push({
            role: block.role === 'model' ? 'assistant' : 'user',
            content: text,
          })
        }
      }
    }

    if (messages.length === 0) {
      throw new Error('No message content provided')
    }

    const { content } = await callChatCompletionWithFallback(messages, {
      temperature: generationConfig?.temperature ?? 0.7,
      responseFormat: generationConfig?.responseMimeType === 'application/json' ? 'json' : 'text',
    })

    // Convert OpenAI response back to Gemini format
    const geminiCompatResponse = {
      candidates: [{
        content: {
          parts: [{ text: content }],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
      }],
      promptFeedback: { safetyRatings: [] },
    }

    return new Response(JSON.stringify(geminiCompatResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return createErrorResponse(error, 400, 'gemini-proxy', corsHeaders)
  }
})
