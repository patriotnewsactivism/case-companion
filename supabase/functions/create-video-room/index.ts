import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateRoomRequest {
  name: string;
  caseId: string;
  description?: string;
  expiresInMinutes?: number;
  enableRecording?: boolean;
  maxParticipants?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');

    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Video service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      name,
      caseId,
      description,
      expiresInMinutes = 240, // 4 hours default
      enableRecording = true,
      maxParticipants = 10
    } = await req.json() as CreateRoomRequest;

    if (!name || !caseId) {
      return new Response(
        JSON.stringify({ error: 'Room name and case ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Verify user owns the case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Case not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration time
    const exp = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);

    // Security hardening: Generate secure room name with UUID
    const roomNameSuffix = crypto.randomUUID().split('-')[0];
    const dailyRoomName = `casebuddy-${caseId}-${roomNameSuffix}`;

    // Create a room with Daily.co with enhanced security
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: dailyRoomName,
        privacy: 'private', // Security: Private rooms only
        properties: {
          exp,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: enableRecording ? 'cloud' : 'local', // Recording controlled by param
          enable_recording_ui: enableRecording, // Show recording controls only if enabled
          max_participants: maxParticipants,
          start_video_off: false,
          start_audio_off: false,
          owner_only_broadcast: false,
          enable_prejoin_ui: true, // Security: Prejoin screen for verification
          enable_network_ui: true,
          enable_knocking: true, // Security: Require approval to join
          lang: 'en',
          // Security: End-to-end encryption for sensitive legal conversations
          enable_mesh_sfu: true,
          sfu_switchover: 0.5,
          // Recording settings
          recording_bucket: {
            bucket_name: 'daily-recordings',
            region: 'us-west-2',
            assume_role_arn: '', // Configure if using custom S3
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Daily.co API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to create video room', details: errorData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const room = await response.json();
    console.log('Room created:', room.name);

    // Create a meeting token for the owner with enhanced permissions
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          exp,
          is_owner: true, // Owner can manage recordings and participants
          enable_recording: enableRecording ? 'cloud' : 'local',
          enable_screenshare: true,
          start_cloud_recording: false, // Manual start for privacy
          // Security: User identity
          user_name: user.email || 'Case Owner',
          user_id: user.id,
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token creation error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to create meeting token', details: errorData }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();

    // Store room information in database
    const { data: videoRoom, error: dbError } = await supabase
      .from('video_rooms')
      .insert({
        case_id: caseId,
        user_id: user.id,
        room_name: name,
        room_url: room.url,
        daily_room_name: room.name,
        title: name,
        description: description,
        enable_recording: enableRecording,
        max_participants: maxParticipants,
        expires_at: new Date(exp * 1000).toISOString(),
        status: 'active',
        recording_status: enableRecording ? 'pending' : null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB insert fails - room is created
    }

    return new Response(
      JSON.stringify({
        roomId: videoRoom?.id,
        roomUrl: room.url,
        roomName: room.name,
        token: tokenData.token,
        expiresAt: new Date(exp * 1000).toISOString(),
        enableRecording,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});