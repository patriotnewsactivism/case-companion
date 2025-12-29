import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailyRecordingWebhook {
  type: string; // 'recording.ready', 'recording.started', 'recording.finished'
  room: string;
  recording_id: string;
  download_link?: string;
  duration?: number;
  start_ts?: number;
  status?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security: Verify webhook authenticity
    // Daily.co sends webhooks - in production, verify the signature
    const webhookSecret = Deno.env.get('DAILY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('x-daily-signature');
      // TODO: Implement signature verification for production
      // For now, we'll trust the webhook
    }

    const payload = await req.json() as DailyRecordingWebhook;
    console.log('Recording webhook received:', payload);

    const { type, room, recording_id, download_link, duration, start_ts, status } = payload;

    // Find the video room by Daily room name
    const { data: videoRoom, error: roomError } = await supabase
      .from('video_rooms')
      .select('*')
      .eq('daily_room_name', room)
      .single();

    if (roomError || !videoRoom) {
      console.error('Video room not found:', room);
      return new Response(
        JSON.stringify({ error: 'Video room not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different webhook types
    switch (type) {
      case 'recording.started':
        // Update room to indicate recording has started
        await supabase
          .from('video_rooms')
          .update({
            recording_started_at: new Date(start_ts ? start_ts * 1000 : Date.now()).toISOString(),
            recording_status: 'recording',
          })
          .eq('id', videoRoom.id);

        console.log(`Recording started for room ${room}`);
        break;

      case 'recording.finished':
        // Recording has finished but may not be ready for download yet
        await supabase
          .from('video_rooms')
          .update({
            recording_status: 'processing',
          })
          .eq('id', videoRoom.id);

        console.log(`Recording finished for room ${room}, processing...`);
        break;

      case 'recording.ready':
        // Recording is ready for download
        if (!download_link) {
          console.error('No download link provided in webhook');
          break;
        }

        // Update video room with recording URL
        const { error: updateError } = await supabase
          .from('video_rooms')
          .update({
            recording_url: download_link,
            recording_status: 'completed',
          })
          .eq('id', videoRoom.id);

        if (updateError) {
          console.error('Error updating video room:', updateError);
          break;
        }

        console.log(`Recording ready for room ${room}: ${download_link}`);

        // Trigger transcription if recording is enabled
        if (videoRoom.enable_recording) {
          // Call transcription function
          const transcribeUrl = `${supabaseUrl}/functions/v1/transcribe-recording`;

          try {
            const transcribeResponse = await fetch(transcribeUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                roomId: videoRoom.id,
                recordingUrl: download_link,
              }),
            });

            if (!transcribeResponse.ok) {
              console.error('Failed to trigger transcription:', await transcribeResponse.text());
            } else {
              console.log('Transcription triggered successfully');
            }
          } catch (transcribeError) {
            console.error('Error triggering transcription:', transcribeError);
          }
        }
        break;

      case 'recording.error':
        // Recording failed
        await supabase
          .from('video_rooms')
          .update({
            recording_status: 'failed',
          })
          .eq('id', videoRoom.id);

        console.error(`Recording failed for room ${room}`);
        break;

      default:
        console.log(`Unknown webhook type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
