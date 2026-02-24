import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, sanitizeString, validateInteger } from '../_shared/validation.ts';

interface CreateRoomRequest {
  name: string;
  caseId: string;
  description?: string;
  expiresInMinutes?: number;
  enableRecording?: boolean;
  maxParticipants?: number;
}

interface VideoRoomRow {
  id: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    validateEnvVars(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DAILY_API_KEY']);

    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')!;

    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authorized || !authResult.user || !authResult.supabase) {
      return createErrorResponse(
        new Error(authResult.error || 'Unauthorized'),
        401,
        'create-video-room',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    // Rate limiting: 20 room creations per hour per user
    const rateLimitCheck = checkRateLimit(`create-room:${user.id}`, 20, 3600000);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: new Date(rateLimitCheck.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse and validate request body
    const requestBody = await req.json();
    validateRequestBody<CreateRoomRequest>(requestBody, ['name', 'caseId']);

    const name = sanitizeString(requestBody.name, 'name', 200);
    const caseId = validateUUID(requestBody.caseId, 'caseId');
    const description = requestBody.description ? sanitizeString(requestBody.description, 'description', 1000) : undefined;
    const expiresInMinutes = requestBody.expiresInMinutes ? validateInteger(requestBody.expiresInMinutes, 'expiresInMinutes', 1, 1440) : 240;
    const enableRecording = requestBody.enableRecording ?? true;
    const maxParticipants = requestBody.maxParticipants ? validateInteger(requestBody.maxParticipants, 'maxParticipants', 2, 50) : 10;

    // Security: Verify user owns the case
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single();

    if (caseError || !caseData) {
      console.error('Case verification failed:', caseError);
      return forbiddenResponse('Case not found or access denied', corsHeaders);
    }

    console.log(`User verified as owner of case ${caseId}`);

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
        privacy: 'private',
        properties: {
          exp,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: enableRecording ? 'cloud' : 'local',
          max_participants: maxParticipants,
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

      // Cleanup: remove room if token creation failed.
      try {
        await fetch(`https://api.daily.co/v1/rooms/${room.name}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup Daily room after token failure:', cleanupError);
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create meeting token', details: errorData }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();

    const legacyCompatibleMetadata = {
      title: name,
      daily_room_name: room.name,
      enable_recording: enableRecording,
      status: 'active',
    };

    // Store room information in database.
    // Support both modern schema (daily_room_name/title/enable_recording/status)
    // and legacy schema (room_name/room_url/is_active/metadata).
    let videoRoom: VideoRoomRow | null = null;

    const { data: modernRoom, error: modernError } = await supabase
      .from('video_rooms')
      .insert({
        case_id: caseId,
        user_id: user.id,
        room_name: room.name,
        room_url: room.url,
        daily_room_name: room.name,
        title: name,
        description: description,
        enable_recording: enableRecording,
        expires_at: new Date(exp * 1000).toISOString(),
        status: 'active',
        is_active: true,
        max_participants: maxParticipants,
        metadata: legacyCompatibleMetadata,
      })
      .select('id')
      .single();

    if (!modernError && modernRoom) {
      videoRoom = modernRoom as VideoRoomRow;
    } else {
      console.warn('Modern video_rooms insert failed, trying legacy-compatible insert:', modernError);

      const { data: legacyRoom, error: legacyError } = await supabase
        .from('video_rooms')
        .insert({
          case_id: caseId,
          user_id: user.id,
          room_name: room.name,
          room_url: room.url,
          description: description,
          expires_at: new Date(exp * 1000).toISOString(),
          is_active: true,
          max_participants: maxParticipants,
          metadata: legacyCompatibleMetadata,
        })
        .select('id')
        .single();

      if (!legacyError && legacyRoom) {
        videoRoom = legacyRoom as VideoRoomRow;
      } else {
        console.error('Legacy video_rooms insert failed:', legacyError);

        // Cleanup: remove room if persistence failed so callers do not receive
        // a room that cannot be securely re-joined through roomId checks.
        try {
          await fetch(`https://api.daily.co/v1/rooms/${room.name}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${DAILY_API_KEY}`,
            },
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup Daily room after database failure:', cleanupError);
        }

        throw new Error(
          `Failed to persist video room: ${legacyError?.message || modernError?.message || 'unknown database error'}`
        );
      }
    }

    return new Response(
      JSON.stringify({
        roomId: videoRoom.id,
        roomUrl: room.url,
        roomName: room.name,
        token: tokenData.token,
        expiresAt: new Date(exp * 1000).toISOString(),
        enableRecording,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating video room:', error);
    return createErrorResponse(error, 500, 'create-video-room', corsHeaders);
  }
});
