import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
} from '../_shared/errorHandler.ts';
import { validateUUID, validateURL } from '../_shared/validation.ts';

interface TranscribeRequest {
  roomId: string;
  recordingUrl: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = (await req.json()) as Record<string, unknown>;
    validateRequestBody<TranscribeRequest>(requestBody, ['roomId', 'recordingUrl']);

    const roomId = validateUUID(requestBody.roomId, 'roomId');
    const recordingUrl = validateURL(requestBody.recordingUrl);

    await supabase
      .from('video_rooms')
      .update({
        transcription_status: 'processing',
      })
      .eq('id', roomId);

    console.log(`Starting transcription for room ${roomId}`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');

      await supabase
        .from('video_rooms')
        .update({
          transcription_status: 'failed',
          transcription_text: 'Transcription service not configured. Please add OPENAI_API_KEY to enable automatic transcription.',
        })
        .eq('id', roomId);

      return new Response(
        JSON.stringify({
          error: 'Transcription service not configured',
          message: 'Add OPENAI_API_KEY environment variable to enable transcription'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const recordingResponse = await fetch(recordingUrl);
      if (!recordingResponse.ok) {
        throw new Error('Failed to download recording');
      }

      const audioBlob = await recordingResponse.blob();

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.mp4');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        throw new Error(`Whisper API error: ${errorText}`);
      }

      type WhisperSegment = { start: number; end: number; text: string };

      const transcriptionData = await whisperResponse.json();
      const transcriptionText = transcriptionData.text;
      const rawSegments = Array.isArray(transcriptionData.segments)
        ? transcriptionData.segments
        : [];
      const segments = rawSegments as WhisperSegment[];

      console.log(`Transcription completed for room ${roomId}`);

      let formattedTranscription = transcriptionText;
      if (segments.length > 0) {
        formattedTranscription = segments.map((segment) => {
          const start = formatTimestamp(segment.start);
          const end = formatTimestamp(segment.end);
          return `[${start} - ${end}] ${segment.text}`;
        }).join('\n\n');
      }

      const { error: updateError } = await supabase
        .from('video_rooms')
        .update({
          transcription_text: formattedTranscription,
          transcription_status: 'completed',
          transcription_processed_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (updateError) {
        throw new Error(`Failed to update room: ${updateError.message}`);
      }

      const { data: videoRoom } = await supabase
        .from('video_rooms')
        .select('case_id, user_id, title')
        .eq('id', roomId)
        .single();

      if (videoRoom) {
        await supabase
          .from('documents')
          .insert({
            case_id: videoRoom.case_id,
            user_id: videoRoom.user_id,
            name: `${videoRoom.title} - Transcript`,
            file_url: recordingUrl,
            file_type: 'text/plain',
            summary: `Automated transcription of video conference: ${videoRoom.title}`,
            ai_analyzed: false,
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          transcription: formattedTranscription,
          segments: segments.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);

      await supabase
        .from('video_rooms')
        .update({
          transcription_status: 'failed',
          transcription_text: `Transcription failed: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}`,
        })
        .eq('id', roomId);

      throw transcriptionError;
    }

  } catch (error) {
    console.error('Error:', error);
    return createErrorResponse(error, 500, 'transcribe-recording', getCorsHeaders(req));
  }
});

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
