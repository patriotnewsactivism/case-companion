import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JoinRoomRequest {
  roomName: string;
  roomId?: string;
  userName?: string;
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

    const { roomName, roomId, userName } = await req.json() as JoinRoomRequest;

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: 'Room name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Verify user has access to the room through the case
    let videoRoomData;
    if (roomId) {
      const { data, error: roomDbError } = await supabase
        .from('video_rooms')
        .select('*, cases!inner(user_id)')
        .eq('id', roomId)
        .eq('daily_room_name', roomName)
        .single();

      if (roomDbError || !data) {
        return new Response(
          JSON.stringify({ error: 'Room not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user has access to the case
      if (data.cases.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this video room' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      videoRoomData = data;
    }

    // Get room info to verify it exists and is active
    const roomResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!roomResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Room not found or has expired' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const room = await roomResponse.json();

    // Verify room hasn't expired
    if (room.config?.exp && room.config.exp < Math.floor(Date.now() / 1000)) {
      // Mark room as expired in database
      if (roomId) {
        await supabase
          .from('video_rooms')
          .update({ status: 'expired' })
          .eq('id', roomId);
      }

      return new Response(
        JSON.stringify({ error: 'Room has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a meeting token for the user with appropriate permissions
    const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 4); // 4 hours
    const isOwner = videoRoomData?.user_id === user.id;

    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp,
          is_owner: isOwner,
          user_name: userName || user.email || 'Participant',
          user_id: user.id,
          enable_screenshare: true,
          enable_recording: videoRoomData?.enable_recording ? 'cloud' : 'local',
          start_cloud_recording: false, // Must be started manually by owner
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token creation error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to create meeting token' }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();

    // Log participant joining
    if (roomId) {
      await supabase
        .from('video_room_participants')
        .insert({
          room_id: roomId,
          user_id: user.id,
          participant_name: userName || user.email || 'Participant',
          is_owner: isOwner,
          participant_token: tokenData.token.substring(0, 20) + '...', // Store partial token for audit
        });

      // Update participants log in video_rooms
      const currentLog = videoRoomData?.participants_log || [];
      const newLog = [
        ...currentLog,
        {
          user_id: user.id,
          user_name: userName || user.email,
          joined_at: new Date().toISOString(),
          is_owner: isOwner,
        }
      ];

      await supabase
        .from('video_rooms')
        .update({ participants_log: newLog })
        .eq('id', roomId);
    }

    return new Response(
      JSON.stringify({
        roomUrl: room.url,
        roomName: room.name,
        token: tokenData.token,
        isOwner,
        enableRecording: videoRoomData?.enable_recording || false,
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