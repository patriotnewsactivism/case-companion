# Quick Video Calling Setup

## Why Video Isn't Working

Your video calling feature requires a **Daily.co API key** which is currently missing.

## 3-Step Fix (5 minutes)

### Step 1: Get Your API Key

1. Go to https://www.daily.co/ and sign up (FREE account)
2. After signup, go to https://dashboard.daily.co/
3. Copy your API key from the dashboard

### Step 2: Add to Local .env

Open `.env` and set:

```bash
DAILY_API_KEY="your_api_key_here"
```

### Step 3: Add to Supabase (CRITICAL!)

**This is the most important step - video won't work without it!**

1. Go to: https://app.supabase.com/project/rerbrlrxptnusypzpghj/settings/functions
2. Click "Edge Functions" in sidebar
3. Click "Manage secrets"
4. Add new secret:
   - **Name**: `DAILY_API_KEY`
   - **Value**: Your Daily.co API key (same as Step 2)
5. Click "Save"

## Test It

1. Restart your development server (if running)
2. Log into your app
3. Navigate to any case
4. Click "Create Video Room" or similar button
5. You should see a video interface open

## Troubleshooting

### Still not working?

Run the diagnostic script:

```bash
chmod +x scripts/check-video-config.sh
./scripts/check-video-config.sh
```

### Edge functions not deployed?

The functions should auto-deploy, but if not:

```bash
# Via Supabase CLI (if installed)
supabase functions deploy create-video-room
supabase functions deploy join-video-room
```

Or they'll deploy automatically on your next git push if CI/CD is configured.

### Common errors:

- **"Failed to create video room"** → DAILY_API_KEY not in Supabase secrets
- **"Missing required environment variable"** → DAILY_API_KEY not set in Supabase
- **403/401 errors** → Check API key is valid at Daily.co dashboard

## What You Get

✅ Secure video conferencing
✅ Screen sharing
✅ Recording (optional)
✅ Automatic transcription (if OPENAI_API_KEY is set)
✅ Up to 100,000 free participant minutes/month

## Free vs Paid

- **Free Tier**: 100,000 participant minutes/month (perfect for development)
- **Pro Tier**: Unlimited ($99+/month, needed for heavy production use)

## More Details

- Full guide: `VIDEO_CALLING_FIX.md`
- Setup documentation: `VIDEO_CONFERENCING_SETUP.md`
- Check config: `./scripts/check-video-config.sh`

---

**Bottom Line**: Add `DAILY_API_KEY` to both `.env` AND Supabase Edge Functions secrets, then video will work! 🎥
