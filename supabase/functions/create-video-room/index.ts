import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateRoomRequest {
  name: string;
  caseId?: string;
  expiresInMinutes?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
    
    if (!DAILY_API_KEY) {
      console.error('DAILY_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Video service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, caseId, expiresInMinutes = 60 } = await req.json() as CreateRoomRequest;

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Room name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration time
    const exp = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);

    // Create a room with Daily.co
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `casebuddy-${caseId || 'general'}-${Date.now()}`,
        privacy: 'private',
        properties: {
          exp,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: 'cloud',
          max_participants: 10,
          start_video_off: false,
          start_audio_off: false,
          owner_only_broadcast: false,
          enable_prejoin_ui: true,
          enable_network_ui: true,
          enable_knocking: true,
          lang: 'en',
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

    // Create a meeting token for the user
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
          is_owner: true,
          enable_recording: 'cloud',
          enable_screenshare: true,
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

    return new Response(
      JSON.stringify({
        roomUrl: room.url,
        roomName: room.name,
        token: tokenData.token,
        expiresAt: new Date(exp * 1000).toISOString(),
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