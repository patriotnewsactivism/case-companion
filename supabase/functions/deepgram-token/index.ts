/**
 * deepgram-token — issues a short-lived Deepgram API key for browser clients.
 *
 * The browser uses this ephemeral key to open a WebSocket directly to
 * api.deepgram.com without exposing the master key in client-side code.
 *
 * Returns: { key: string; expires_at: string }
 *
 * Set Supabase secret:
 *   npx supabase secrets set DEEPGRAM_API_KEY=<your_key>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, createErrorResponse } from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';

const DEEPGRAM_API_URL = 'https://api.deepgram.com';
// Token TTL — 1 hour is generous for a single courtroom session
const TOKEN_TTL_SECONDS = 3600;

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user) {
      return createErrorResponse(
        new Error(authResult.error ?? 'Unauthorized'),
        401,
        'deepgram-token',
        corsHeaders
      );
    }

    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      return createErrorResponse(
        new Error('Deepgram is not configured. Set DEEPGRAM_API_KEY in Supabase secrets.'),
        503,
        'deepgram-token',
        corsHeaders
      );
    }

    // Request a short-lived ephemeral key from Deepgram
    // Docs: https://developers.deepgram.com/reference/grant-token
    const dgRes = await fetch(`${DEEPGRAM_API_URL}/v1/auth/grant`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ephemeral',
        time_to_live_in_seconds: TOKEN_TTL_SECONDS,
      }),
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text().catch(() => dgRes.statusText);
      console.error(`[deepgram-token] Deepgram grant error ${dgRes.status}: ${errText}`);
      return createErrorResponse(
        new Error(`Failed to generate Deepgram token (${dgRes.status})`),
        502,
        'deepgram-token',
        corsHeaders
      );
    }

    const tokenData = await dgRes.json() as { key?: string };
    if (!tokenData.key) {
      return createErrorResponse(
        new Error('Deepgram did not return a key in the grant response'),
        502,
        'deepgram-token',
        corsHeaders
      );
    }

    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    return new Response(
      JSON.stringify({ key: tokenData.key, expires_at: expiresAt }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[deepgram-token] Unexpected error:', err);
    return createErrorResponse(
      err instanceof Error ? err : new Error(String(err)),
      500,
      'deepgram-token',
      corsHeaders
    );
  }
});
