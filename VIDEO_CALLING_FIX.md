# Video Calling Fix - Missing Daily.co API Configuration

## Problem

The video calling feature doesn't work because the **DAILY_API_KEY** environment variable is not configured. This is required for the video conferencing functionality powered by Daily.co.

## Root Cause

1. **Missing API Key**: The `DAILY_API_KEY` is not set in the `.env` file
2. **Edge Functions Requirement**: The edge functions `create-video-room` and `join-video-room` require this key
3. **No Fallback**: There's no fallback or helpful error message when the key is missing

## Required Setup

### Step 1: Get Daily.co API Key

1. Go to https://www.daily.co/ and create a free account
2. Navigate to the Dashboard
3. Go to the "Developers" section
4. Copy your API key

### Step 2: Add to Local .env File

Add this line to `/home/user/case-companion/.env`:

```bash
# Daily.co API (for video conferencing)
# Required for creating and managing video rooms
# Get from: https://dashboard.daily.co/
DAILY_API_KEY=your_daily_api_key_here
```

### Step 3: Configure Supabase Edge Functions Secrets

The DAILY_API_KEY must be set in Supabase for the edge functions to work. You have two options:

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://app.supabase.com/project/rerbrlrxptnusypzpghj/settings/functions
2. Click on "Edge Functions" in the left sidebar
3. Click on "Manage secrets"
4. Add a new secret:
   - Name: `DAILY_API_KEY`
   - Value: Your Daily.co API key
5. Click "Save"

#### Option B: Via Supabase CLI (If installed)

```bash
supabase secrets set DAILY_API_KEY=your_daily_api_key_here
```

### Step 4: Deploy Edge Functions (If not already deployed)

The following edge functions need to be deployed with the DAILY_API_KEY:

- `create-video-room` - Creates new video conference rooms
- `join-video-room` - Generates tokens for joining existing rooms
- `recording-webhook` - Handles recording completion webhooks
- `transcribe-recording` - Transcribes recordings using OpenAI Whisper

If using Supabase CLI:
```bash
cd supabase/functions
supabase functions deploy create-video-room
supabase functions deploy join-video-room
supabase functions deploy recording-webhook
supabase functions deploy transcribe-recording
```

Otherwise, the functions should auto-deploy when you push to your repository (if CI/CD is configured).

## Verification Steps

After configuring the DAILY_API_KEY:

1. **Test Room Creation**:
   - Log into your app
   - Navigate to a case
   - Try to create a video room
   - You should see a success message and be redirected to the Daily.co video interface

2. **Check Edge Function Logs**:
   - Go to https://app.supabase.com/project/rerbrlrxptnusypzpghj/logs/edge-functions
   - Filter by function: `create-video-room`
   - Look for any errors related to DAILY_API_KEY

3. **Test Video Features**:
   - Create a video room
   - Join the room
   - Test video/audio controls
   - Test screen sharing
   - Test recording (if enabled)

## Daily.co Account Tiers

### Free Tier
- Limited to 100,000 participant minutes/month
- Suitable for development and small teams
- Full feature access including recording

### Pro Tier ($99+/month)
- Required for production use
- Unlimited participant minutes
- SLA guarantees
- Advanced features

## Additional Configuration

### Optional: Recording Features

If you want automatic transcription of recordings:

1. Ensure `OPENAI_API_KEY` is configured in .env
2. Configure Daily.co webhooks:
   - Go to Daily.co Dashboard → Developers → Webhooks
   - Add webhook URL: `https://rerbrlrxptnusypzpghj.supabase.co/functions/v1/recording-webhook`
   - Enable events: `recording.started`, `recording.ready`, `recording.finished`, `recording.error`

### Optional: Webhook Security

For production, add webhook signature verification:

```bash
DAILY_WEBHOOK_SECRET=your_webhook_secret_here
```

## Current Environment Status

Based on your `.env` file, you have:
- ✅ VITE_SUPABASE_URL configured
- ✅ VITE_SUPABASE_PUBLISHABLE_KEY configured
- ✅ OPENAI_API_KEY configured (for transcription)
- ✅ VITE_GOOGLE_CLIENT_ID configured
- ✅ VITE_GOOGLE_API_KEY configured
- ❌ **DAILY_API_KEY missing** (required for video)
- ❌ **DAILY_WEBHOOK_SECRET missing** (optional)

## Error Messages to Look For

If DAILY_API_KEY is not configured, you'll see errors like:

- **Frontend**: "Failed to create video room" or "Failed to join video room"
- **Edge Function Logs**: "Missing required environment variable: DAILY_API_KEY"
- **Console**: 500 Internal Server Error when calling video endpoints

## Migration Path

Since the project already has all the code for Daily.co integration, you just need to:

1. ✅ Get a Daily.co API key
2. ✅ Add it to .env locally (for development)
3. ✅ Add it to Supabase Edge Functions secrets (for production)
4. ✅ Test video room creation
5. ✅ Configure webhooks (optional, for recording)

## Support Resources

- Daily.co Documentation: https://docs.daily.co/
- Daily.co Dashboard: https://dashboard.daily.co/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Video Setup Guide: See `/VIDEO_CONFERENCING_SETUP.md` in the repository

## Security Notes

- ⚠️ Never commit DAILY_API_KEY to git
- ⚠️ The key is already in .gitignore via the .env pattern
- ✅ Edge functions use server-side secrets securely
- ✅ All video rooms are private and require authentication
- ✅ Room access is controlled by case ownership (RLS policies)
- ✅ Meeting tokens expire after 4 hours for security
