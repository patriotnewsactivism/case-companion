import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getCorsHeaders,
  createErrorResponse,
  validateEnvVars,
  validateRequestBody,
  checkRateLimit,
} from '../_shared/errorHandler.ts';
import { verifyAuth, forbiddenResponse } from '../_shared/auth.ts';
import { validateUUID, sanitizeString } from '../_shared/validation.ts';

interface JoinRoomRequest {
  roomId: string;
  roomName?: string;
  userName?: string;
}

interface VideoRoomRecord {
  id: string;
  case_id?: string | null;
  user_id?: string;
  room_name?: string;
  daily_room_name?: string;
  enable_recording?: boolean;
  metadata?: Record<string, unknown> | null;
  participants_log?: unknown[];
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
        'join-video-room',
        corsHeaders
      );
    }

    const { user, supabase } = authResult;

    // Rate limiting: 30 room joins per hour per user
    const rateLimitCheck = checkRateLimit(`join-room:${user.id}`, 30, 3600000);
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
    validateRequestBody<JoinRoomRequest>(requestBody, ['roomId']);

    const roomId = validateUUID(requestBody.roomId, 'roomId');
    const providedRoomName = requestBody.roomName
      ? sanitizeString(requestBody.roomName, 'roomName', 200)
      : undefined;
    const userName = requestBody.userName ? sanitizeString(requestBody.userName, 'userName', 100) : undefined;

    // Security: Verify user has access to the room.
    const { data, error: roomDbError } = await supabase
      .from('video_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomDbError || !data) {
      console.error('Room verification failed:', roomDbError);
      return forbiddenResponse('Room not found or access denied', corsHeaders);
    }

    const videoRoomData = data as unknown as VideoRoomRecord;

    let hasAccess = videoRoomData.user_id === user.id;
    if (!hasAccess && videoRoomData.case_id) {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id')
        .eq('id', videoRoomData.case_id)
        .eq('user_id', user.id)
        .maybeSingle();

      hasAccess = !!caseData && !caseError;
    }

    if (!hasAccess) {
      console.error('User does not have access to this room');
      return forbiddenResponse('Access denied to this video room', corsHeaders);
    }

    const metadata: Record<string, unknown> = videoRoomData.metadata && typeof videoRoomData.metadata === 'object'
      ? videoRoomData.metadata
      : {};
    const metadataDailyRoomName = typeof metadata.daily_room_name === 'string'
      ? metadata.daily_room_name
      : undefined;

    let roomName = videoRoomData.daily_room_name || videoRoomData.room_name || metadataDailyRoomName;
    if (!roomName) {
      throw new Error('Video room record is missing room name information');
    }

    if (providedRoomName && providedRoomName !== roomName) {
      // Legacy rows may store a display title in room_name while the caller passes
      // the actual Daily room identifier. Prefer the caller-supplied room name
      // when it looks like a Daily room slug.
      if (providedRoomName.startsWith('casebuddy-')) {
        console.warn('Room name mismatch detected; using caller-provided Daily room slug.');
        roomName = providedRoomName;
      } else {
        console.warn('Room name mismatch detected; using persisted room name.');
      }
    }

    console.log(`User verified for room ${roomId}`);

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
      // Mark room as expired/inactive in database (schema-compatible).
      const { error: statusUpdateError } = await supabase
        .from('video_rooms')
        .update({ status: 'expired' })
        .eq('id', roomId);
      if (statusUpdateError) {
        await supabase
          .from('video_rooms')
          .update({ is_active: false })
          .eq('id', roomId);
      }

      return new Response(
        JSON.stringify({ error: 'Room has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a meeting token for the user with appropriate permissions
    const exp = Math.floor(Date.now() / 1000) + (60 * 60 * 4); // 4 hours
    const isOwner = videoRoomData.user_id === user.id;
    const metadataEnableRecording = typeof metadata.enable_recording === 'boolean'
      ? metadata.enable_recording
      : undefined;
    const enableRecording = videoRoomData.enable_recording ?? metadataEnableRecording ?? true;

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
          enable_recording: enableRecording ? 'cloud' : 'local',
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

    // Log participant joining (legacy schemas may not have this table).
    const { error: participantLogError } = await supabase
      .from('video_room_participants')
      .insert({
        room_id: roomId,
        user_id: user.id,
        participant_name: userName || user.email || 'Participant',
        is_owner: isOwner,
        participant_token: tokenData.token.substring(0, 20) + '...', // Store partial token for audit
      });

    if (participantLogError) {
      console.warn('Participant log insert skipped:', participantLogError.message);
    }

    // Update participants log in video_rooms (modern schema only).
    const currentLog = Array.isArray(videoRoomData.participants_log)
      ? videoRoomData.participants_log
      : [];
    const newLog = [
      ...currentLog,
      {
        user_id: user.id,
        user_name: userName || user.email,
        joined_at: new Date().toISOString(),
        is_owner: isOwner,
      }
    ];

    const { error: participantsUpdateError } = await supabase
      .from('video_rooms')
      .update({ participants_log: newLog })
      .eq('id', roomId);
    if (participantsUpdateError) {
      console.warn('participants_log update skipped:', participantsUpdateError.message);
    }

    return new Response(
      JSON.stringify({
        roomId,
        roomUrl: room.url,
        roomName: room.name,
        token: tokenData.token,
        isOwner,
        enableRecording,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error joining video room:', error);
    return createErrorResponse(error, 500, 'join-video-room', corsHeaders);
  }
});
