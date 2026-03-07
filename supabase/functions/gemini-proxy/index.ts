import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders, createErrorResponse } from '../_shared/errorHandler.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    if (!googleApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set')
    }

    const { model = 'gemini-1.5-flash', contents, system_instruction, generationConfig } = await req.json()

    // Default to gemini-1.5-flash if not specified
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        system_instruction,
        generationConfig,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status,
    })
  } catch (error) {
    return createErrorResponse(error, 400, 'gemini-proxy', corsHeaders)
  }
})
