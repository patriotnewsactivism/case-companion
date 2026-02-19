import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/errorHandler.ts';

interface TranscribeRequest {
  roomId: string;
  recordingUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { roomId, recordingUrl } = await req.json() as TranscribeRequest;

    if (!roomId || !recordingUrl) {
      return new Response(
        JSON.stringify({ error: 'Room ID and recording URL are required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('video_rooms')
      .update({
        transcription_status: 'processing',
      })
      .eq('id', roomId);

    console.log(`Starting transcription for room ${roomId}`);

    // Use OpenAI Whisper API or other transcription service
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured');

      // Update status to indicate transcription is not available
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
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Download the recording
      const recordingResponse = await fetch(recordingUrl);
      if (!recordingResponse.ok) {
        throw new Error('Failed to download recording');
      }

      const audioBlob = await recordingResponse.blob();

      // Prepare form data for Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.mp4');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      // Call OpenAI Whisper API
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

      // Format transcription with timestamps
      let formattedTranscription = transcriptionText;
      if (segments.length > 0) {
        formattedTranscription = segments.map((segment) => {
          const start = formatTimestamp(segment.start);
          const end = formatTimestamp(segment.end);
          return `[${start} - ${end}] ${segment.text}`;
        }).join('\n\n');
      }

      // Update video room with transcription
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

      // Also create a document in the case for the transcription
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
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );

    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);

      // Update status to failed
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to format seconds to HH:MM:SS
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
