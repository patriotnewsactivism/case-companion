import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
} from '../_shared/errorHandler.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { validateUUID, sanitizeString, validateInteger } from '../_shared/validation.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  aiRole?: string;
}

interface SessionMetrics {
  objectionsReceived: number;
  objectionsSustained: number;
  objectionsOverruled: number;
  fallaciesCommitted: string[];
  rhetoricalScore: number;
  wordCount: number;
  fillerWords: { word: string; count: number }[];
  wordsPerMinute: number;
  pauseCount: number;
  overallScore: number;
}

interface SaveSessionRequest {
  id: string;
  duration_seconds: number;
  transcript: TranscriptEntry[];
  audio_base64?: string;
  audio_mimetype?: string;
  metrics: SessionMetrics;
  feedback?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);

    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'save-session',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<SaveSessionRequest>(requestBody, ['id', 'duration_seconds', 'transcript', 'metrics']);

    const sessionId = validateUUID(requestBody.id, 'id');
    const durationSeconds = validateInteger(requestBody.duration_seconds, 'duration_seconds', 0, 86400);
    const transcript = requestBody.transcript as TranscriptEntry[];
    const metrics = requestBody.metrics as SessionMetrics;
    const feedback = requestBody.feedback ? sanitizeString(requestBody.feedback as string, 'feedback', 5000) : null;

    const { data: existingSession, error: fetchError } = await supabase
      .from('trial_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !existingSession) {
      return createErrorResponse(
        new Error('Session not found'),
        404,
        'save-session',
        corsHeaders
      );
    }

    const sessionUserId = (existingSession as Record<string, unknown>).user_id;
    if (sessionUserId !== user.id) {
      return createErrorResponse(
        new Error('Access denied'),
        403,
        'save-session',
        corsHeaders
      );
    }

    let audioUrl: string | null = null;

    if (requestBody.audio_base64 && requestBody.audio_mimetype) {
      const audioBase64 = requestBody.audio_base64 as string;
      const audioMimetype = requestBody.audio_mimetype as string;

      const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

      const extension = audioMimetype.split('/')[1] || 'webm';
      const fileName = `sessions/${sessionId}/recording.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('session-recordings')
        .upload(fileName, audioBuffer, {
          contentType: audioMimetype,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload audio:', uploadError);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('session-recordings')
          .getPublicUrl(fileName);
        audioUrl = publicUrl;
      }
    }

    const { data, error: updateError } = await supabase
      .from('trial_sessions')
      .update({
        duration_seconds: durationSeconds,
        transcript,
        audio_url: audioUrl,
        metrics,
        feedback,
        score: metrics.overallScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      return createErrorResponse(
        new Error(`Failed to update session: ${updateError.message}`),
        500,
        'save-session',
        corsHeaders
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in save-session function:', error);
    return createErrorResponse(error, 500, 'save-session', corsHeaders);
  }
});
