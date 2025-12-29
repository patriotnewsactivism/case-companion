# Video Conferencing Setup Guide

This guide explains how to set up and use the secure video conferencing feature with recording and transcription capabilities.

## Features

- **End-to-End Encrypted Video Calls**: Powered by Daily.co with enterprise-grade security
- **Recording & Transcription**: Automatic recording and AI-powered transcription using OpenAI Whisper
- **Optional Recording**: Ability to disable recording for sensitive conversations
- **Access Control**: Only authenticated users with case access can join rooms
- **Audit Trail**: Complete logging of participants and session details
- **Screen Sharing**: Share screens for document review
- **Cloud Storage**: Recordings stored securely in the cloud

## Security Features

1. **Authentication Required**: All participants must be authenticated
2. **Case-Based Access Control**: Only users with access to the case can join
3. **Private Rooms**: All rooms are private by default
4. **Knocking Feature**: Participants must request to join
5. **Pre-join UI**: Verification screen before entering
6. **Secure Tokens**: Time-limited meeting tokens with expiration
7. **Audit Logging**: Complete participant and activity logs
8. **Row-Level Security**: Database policies enforce access control

## Environment Variables Required

### Daily.co API Configuration

1. Sign up for Daily.co account at https://www.daily.co/
2. Get your API key from the dashboard
3. Add to Supabase Edge Functions secrets:

```bash
DAILY_API_KEY=your_daily_api_key_here
```

### Optional: Custom Webhook Secret

For production, add a webhook secret to verify Daily.co webhooks:

```bash
DAILY_WEBHOOK_SECRET=your_webhook_secret_here
```

### OpenAI API for Transcription

To enable automatic transcription:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

If not configured, recording will still work but transcription will be disabled.

## Database Setup

Run the migration to create necessary tables:

```bash
supabase migration up
```

This creates:
- `video_rooms` table: Stores video room information
- `video_room_participants` table: Tracks participant activity
- Row-level security policies
- Helper functions for room management

## Daily.co Webhook Configuration

### 1. Set up webhook endpoint

In your Daily.co dashboard:
1. Go to Developers → Webhooks
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/recording-webhook`
3. Enable events:
   - `recording.started`
   - `recording.ready`
   - `recording.finished`
   - `recording.error`

### 2. Configure webhook security (Recommended)

Add your Daily webhook secret to environment variables for signature verification.

## Usage

### Creating a Video Room

```typescript
import { CreateVideoRoom } from '@/components/CreateVideoRoom';
import { VideoRoom } from '@/components/VideoRoom';

function CasePage({ caseId }) {
  const [showRoom, setShowRoom] = useState(false);
  const [roomData, setRoomData] = useState(null);

  return (
    <div>
      {!showRoom ? (
        <CreateVideoRoom
          caseId={caseId}
          onRoomCreated={(data) => {
            setRoomData(data);
            setShowRoom(true);
          }}
        />
      ) : (
        <VideoRoom
          caseId={caseId}
          roomName={roomData.roomName}
          roomId={roomData.roomId}
          onLeave={() => setShowRoom(false)}
        />
      )}
    </div>
  );
}
```

### Using the Hook

```typescript
import { useVideoRoom } from '@/hooks/useVideoRoom';

function MyComponent() {
  const { createRoom, getActiveRooms, isLoading } = useVideoRoom();

  const handleCreate = async () => {
    const room = await createRoom({
      caseId: 'case-uuid',
      name: 'Strategy Session',
      description: 'Discuss trial preparation',
      enableRecording: true,
      maxParticipants: 10,
      expiresInMinutes: 240,
    });
  };
}
```

## Recording Options

### Enable Recording (Default)

```typescript
await createRoom({
  caseId: 'case-uuid',
  name: 'Recorded Session',
  enableRecording: true, // Recording enabled
});
```

### Disable Recording

```typescript
await createRoom({
  caseId: 'case-uuid',
  name: 'Private Discussion',
  enableRecording: false, // No recording
});
```

When recording is disabled:
- The recording UI controls are hidden
- Daily.co records locally only (not stored)
- No transcription is performed
- Participants see a notice that recording is disabled

## Recording Workflow

1. **Room Creation**: Owner creates room with `enableRecording: true`
2. **Join Meeting**: Participants join with secure tokens
3. **Start Recording**: Owner manually starts recording (not automatic for privacy)
4. **Daily.co Processing**: Recording is processed in the cloud
5. **Webhook Notification**: Daily.co sends `recording.ready` webhook
6. **Storage**: Recording URL stored in `video_rooms.recording_url`
7. **Transcription**: OpenAI Whisper transcribes the recording
8. **Storage**: Transcript stored in `video_rooms.transcription_text`
9. **Document Creation**: Transcript saved as a case document

## API Endpoints

### Create Video Room

**Endpoint**: `POST /functions/v1/create-video-room`

**Request**:
```json
{
  "name": "Strategy Session",
  "caseId": "case-uuid",
  "description": "Optional description",
  "enableRecording": true,
  "maxParticipants": 10,
  "expiresInMinutes": 240
}
```

**Response**:
```json
{
  "roomId": "room-uuid",
  "roomUrl": "https://domain.daily.co/room-name",
  "roomName": "casebuddy-case-id-hash",
  "token": "meeting-token",
  "expiresAt": "2025-12-29T12:00:00Z",
  "enableRecording": true
}
```

### Join Video Room

**Endpoint**: `POST /functions/v1/join-video-room`

**Request**:
```json
{
  "roomName": "casebuddy-case-id-hash",
  "roomId": "room-uuid",
  "userName": "John Doe"
}
```

**Response**:
```json
{
  "roomUrl": "https://domain.daily.co/room-name",
  "roomName": "casebuddy-case-id-hash",
  "token": "meeting-token",
  "isOwner": false,
  "enableRecording": true
}
```

### Recording Webhook

**Endpoint**: `POST /functions/v1/recording-webhook`

Automatically called by Daily.co when recording events occur.

### Transcribe Recording

**Endpoint**: `POST /functions/v1/transcribe-recording`

**Request**:
```json
{
  "roomId": "room-uuid",
  "recordingUrl": "https://daily.co/recording.mp4"
}
```

## Troubleshooting

### Recording Not Starting

1. Check `DAILY_API_KEY` is set correctly
2. Verify room was created with `enableRecording: true`
3. Ensure you're the room owner
4. Check Daily.co dashboard for errors

### Transcription Not Working

1. Verify `OPENAI_API_KEY` is set
2. Check recording webhook is configured
3. Review Edge Function logs for errors
4. Ensure recording URL is accessible

### Participants Can't Join

1. Verify users are authenticated
2. Check user has access to the case
3. Ensure room hasn't expired
4. Review RLS policies

### Webhook Issues

1. Verify webhook URL is correct
2. Check webhook is enabled in Daily.co dashboard
3. Review Edge Function logs
4. Test webhook with Daily.co's webhook tester

## Security Best Practices

1. **Always require authentication** for video rooms
2. **Use time-limited tokens** (4 hours max recommended)
3. **Enable knocking** for additional security
4. **Review participant logs** regularly
5. **Expire old rooms** automatically
6. **Store recordings securely** with encryption
7. **Implement webhook signature verification** in production
8. **Limit max participants** based on use case
9. **Monitor access logs** for unusual activity
10. **Use HTTPS only** for all endpoints

## Cost Considerations

### Daily.co Pricing

- Free tier: Limited minutes/month
- Pro tier: Recommended for production
- Recording storage: Additional cost
- Consider costs for heavy usage

### OpenAI Whisper Pricing

- Charged per minute of audio
- Estimate costs based on expected meeting duration
- Consider batch processing for cost optimization

## Support

For issues or questions:
1. Check Daily.co documentation: https://docs.daily.co/
2. Review OpenAI Whisper docs: https://platform.openai.com/docs/guides/speech-to-text
3. Check Supabase Edge Functions logs
4. Review database logs for RLS policy issues
