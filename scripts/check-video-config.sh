#!/bin/bash
# Script to check video calling configuration

echo "🔍 Checking Video Calling Configuration..."
echo ""

# Load .env file
if [ -f .env ]; then
    source .env
else
    echo "❌ .env file not found"
    exit 1
fi

# Check Supabase configuration
echo "📋 Checking Supabase Configuration..."
if [ -n "$VITE_SUPABASE_URL" ]; then
    echo "  ✅ VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}"
else
    echo "  ❌ VITE_SUPABASE_URL not set"
fi

if [ -n "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
    echo "  ✅ VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY:0:20}..."
else
    echo "  ❌ VITE_SUPABASE_PUBLISHABLE_KEY not set"
fi

echo ""

# Check Daily.co API key
echo "🎥 Checking Video Calling Configuration..."
if [ -n "$DAILY_API_KEY" ] && [ "$DAILY_API_KEY" != "" ]; then
    echo "  ✅ DAILY_API_KEY is set (${DAILY_API_KEY:0:10}...)"
    echo ""
    echo "  📝 Next steps:"
    echo "     1. Add DAILY_API_KEY to Supabase Edge Functions secrets"
    echo "     2. Go to: https://app.supabase.com/project/rerbrlrxptnusypzpghj/settings/functions"
    echo "     3. Click 'Manage secrets' and add DAILY_API_KEY"
else
    echo "  ❌ DAILY_API_KEY not set or empty"
    echo ""
    echo "  📝 Setup required:"
    echo "     1. Create a free account at https://www.daily.co/"
    echo "     2. Get your API key from https://dashboard.daily.co/"
    echo "     3. Add it to your .env file: DAILY_API_KEY=your_key_here"
    echo "     4. Add it to Supabase Edge Functions secrets"
    echo ""
    echo "  📖 For detailed instructions, see: VIDEO_CALLING_FIX.md"
fi

echo ""

# Check OpenAI configuration
echo "🤖 Checking Transcription Configuration..."
if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "" ]; then
    echo "  ✅ OPENAI_API_KEY is set (for recording transcription)"
else
    echo "  ⚠️  OPENAI_API_KEY not set (recording transcription disabled)"
fi

echo ""

# Check edge function deployment
echo "🚀 Checking Edge Function Status..."
SUPABASE_URL="${VITE_SUPABASE_URL}/functions/v1"
SUPABASE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY"

functions=("create-video-room" "join-video-room" "recording-webhook" "transcribe-recording")

for func in "${functions[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
        "${SUPABASE_URL}/${func}" \
        -H "Origin: http://localhost:8080" 2>/dev/null)

    if [ "$response" == "200" ] || [ "$response" == "204" ]; then
        echo "  ✅ ${func}: Deployed"
    else
        echo "  ❌ ${func}: Not deployed or not accessible (HTTP ${response})"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"

# Final summary
if [ -z "$DAILY_API_KEY" ] || [ "$DAILY_API_KEY" == "" ]; then
    echo "❌ VIDEO CALLING DISABLED"
    echo "   Add DAILY_API_KEY to .env and Supabase secrets to enable."
    echo ""
    echo "   Quick start:"
    echo "   1. Visit: https://dashboard.daily.co/"
    echo "   2. Copy your API key"
    echo "   3. Add to .env: DAILY_API_KEY=your_key_here"
    echo "   4. Add to Supabase Edge Functions secrets"
    echo ""
    echo "   Full guide: VIDEO_CALLING_FIX.md"
else
    echo "⚠️  VIDEO CALLING PARTIALLY CONFIGURED"
    echo "   Make sure to add DAILY_API_KEY to Supabase Edge Functions secrets."
    echo ""
    echo "   Test video features:"
    echo "   1. Log into your app"
    echo "   2. Navigate to a case"
    echo "   3. Try creating a video room"
fi

echo "═══════════════════════════════════════════════════════════════"
