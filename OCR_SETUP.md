# OCR Setup Guide

This guide explains how to set up and use the OCR (Optical Character Recognition) functionality in CaseBuddy Professional.

## Overview

The OCR system uses a **three-tier fallback architecture** to extract text from:
- **PDF documents** (all pages)
- **Images** (JPG, PNG, GIF, WebP, BMP, TIFF)
- **Text files** (TXT, DOC, DOCX)

**OCR Provider Priority:**
1. **Azure Computer Vision** (Primary - Best Quality)
2. **OCR.space** (Fallback - Reliable)
3. **Google Gemini** (Last Resort)

After extracting text, the system automatically:
1. Performs legal document analysis
2. Extracts key facts, favorable/adverse findings, and action items
3. Generates timeline events from dates found in the document
4. Creates a summary of the document

## Setup Instructions

Configure at least ONE OCR provider. The system will automatically cascade through available providers.

### Option 1: Azure Computer Vision (Primary - BEST QUALITY)

**You already have this configured!**

Your Azure credentials are already set up:
- Endpoint: https://casebuddy-ocr.cognitiveservices.azure.com/
- Region: East US
- Free tier: 5,000 requests/month
- Quality: Industry-leading OCR accuracy

No action needed - Azure is your primary OCR provider!

### Option 2: Google AI (Last Resort - Optional)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Select a Google Cloud project (or create a new one)
4. Copy the generated API key
5. Set as Supabase secret:
   ```bash
   npx supabase secrets set GOOGLE_AI_API_KEY=your-actual-api-key-here
   ```

**Pros**: Good quality, AI-powered analysis, 1,500 requests/day free
**Cons**: Lower quality than Azure, requires Google account

### Option 3: OCR.space (Fallback - Always Recommended)

1. Go to [OCR.space API](https://ocr.space/ocrapi)
2. Click "Register for free API key"
3. Fill out the form (no credit card required)
4. Check your email for the API key
5. Set as Supabase secret:
   ```bash
   npx supabase secrets set OCR_SPACE_API_KEY=your-actual-api-key-here
   ```

**Pros**: 25,000 requests/month free, no credit card, automatic fallback
**Cons**: Lower quality than Gemini for complex documents

### Recommended Setup: Azure + OCR.space (Already Done!)

You're already set up with the best configuration:

✅ **Azure Computer Vision** - Primary (already configured)
✅ **OCR.space** - Fallback (already configured)
⚪ **Google Gemini** - Last resort (optional)

The system will:
1. Try Azure first (best quality - industry-leading accuracy)
2. Automatically fall back to OCR.space if Azure fails or hits limits
3. Use Gemini as last resort if both fail
4. Never fail OCR (5,000 Azure + 25,000 OCR.space = 30,000 free/month!)

### Verify Configuration

```bash
# List secrets to verify they're set
npx supabase secrets list
```

You should see `GOOGLE_AI_API_KEY` and/or `OCR_SPACE_API_KEY` in the list.

## How to Use OCR

### Individual Document OCR

1. Navigate to a case's Discovery tab
2. Find the document you want to process
3. Click the **Scan icon** (📄) button next to the document
4. Wait for processing (typically 5-30 seconds depending on document size)
5. The document will show an **AI** badge when complete

### Batch OCR

1. Navigate to a case's Discovery tab
2. If unanalyzed documents exist, you'll see an **"Analyze All (X)"** button
3. Click the button to process all unanalyzed PDFs, images, and text files
4. Processing happens in batches of 3 documents at a time
5. You'll see progress indicators during processing

### Automatic OCR

- OCR is **automatically triggered** when you:
  - Upload a new PDF or image file
  - Import documents from Google Drive
  - Import documents from a link

## Document Status Badges

- **AI** (green): Document has been fully analyzed with AI insights
- **OCR** (blue): Document has been OCR'd but analysis is pending
- **TXT** (purple): Audio/video has been transcribed to text

## Transcription for Audio/Video

For audio and video files, you need to set up **OpenAI Whisper**:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Set as Supabase secret:
   ```bash
   npx supabase secrets set OPENAI_API_KEY=sk-your-openai-key
   ```
3. Click the **Music icon** (🎵) button next to audio/video files to transcribe

## Troubleshooting

### OCR Button Not Appearing
- **Check file type**: OCR buttons only appear for PDFs and images
- **Check file URL**: Document must have a valid file_url

### OCR Fails with "OCR service not configured"
- **Solution**: Verify GOOGLE_AI_API_KEY is set in Supabase secrets
- Run: `npx supabase secrets list` to verify

### OCR Processing Timeout
- **Large files**: Files over 10MB may take longer
- **PDF with many pages**: Processing time scales with page count
- **Network issues**: Check your internet connection

### OCR Service Configuration

**Error: "OCR service not configured"**
- You need to set at least ONE of these API keys:
  - `GOOGLE_AI_API_KEY` (primary, best quality)
  - `OCR_SPACE_API_KEY` (fallback, unlimited)

**Recommended**: Set both for best results!

```bash
npx supabase secrets set GOOGLE_AI_API_KEY=your-google-key
npx supabase secrets set OCR_SPACE_API_KEY=your-ocr-space-key
```

### Automatic Fallback Working

When you see: **"Gemini rate limit exceeded, using OCR.space fallback"**
- ✅ This is GOOD! The system is working as designed
- OCR.space is automatically processing your document
- Quality may be slightly lower but still very good
- You have 25,000 free OCR.space requests per month

### Both Services Failed

If you see: **"All OCR providers failed"**
1. Check OCR.space quota: May have used 25,000 monthly requests
2. Check file size: Must be under 5MB for OCR.space
3. Verify both API keys are set correctly
4. Check API key validity at respective provider websites

### Upgrade for Production

**For heavy usage (>25k documents/month):**
- Upgrade Google AI to paid tier: $0.075 per 1M tokens (~$0.01 per 100-page PDF)
- Upgrade OCR.space to Pro: $30/month for 100k requests
- Or use both free tiers: 1,500 Gemini + 25,000 OCR.space = 26,500 free/month!

### OCR Extracts Poor Quality Text
The OCR system is optimized for legal documents and includes:
- Extraction of Bates numbers, exhibit numbers, file stamps
- Preservation of tables, lists, and document structure
- Detection of redactions, watermarks, and quality issues
- Handling of rotated or upside-down text

If extraction quality is poor:
- Ensure the source document is high resolution
- Check that scans are clear and not faded
- Verify PDFs are not password-protected

## API Rate Limits

### Azure Computer Vision (Primary OCR) ✅
**Free Tier Limits:**
- **Monthly limit**: 5,000 requests per month
- **Quality**: Industry-leading OCR accuracy
- **File size limit**: 50MB
- **Multi-page**: Supports multi-page PDFs

**When you hit limits:**
- System automatically falls back to OCR.space
- You'll see: "Azure failed, using OCR.space fallback"
- No interruption to your workflow!

### OCR.space (Fallback OCR) ✅
**Free Tier Limits:**
- **Monthly limit**: 25,000 requests per month
- **Per-request limit**: 5MB file size
- **No daily limit**: Spread across entire month
- **No credit card**: Required free forever

### Google Gemini (Last Resort OCR)
**Free Tier Limits:**
- **Daily limit**: 1,500 requests per day
- **Quality**: Good AI-powered OCR
- Only used if both Azure and OCR.space fail

**Total Free OCR:**
5,000 (Azure) + 25,000 (OCR.space) + 1,500/day (Gemini) = **30,000+ free OCRs per month!**

### OpenAI Whisper (Transcription)
- **User limit**: 5 transcriptions per minute per user
- **File size limit**: 25MB (Whisper API limit)

## Cost Considerations

### Google AI Gemini 2.0 Flash
**Free Tier:**
- **Requests**: 1,500 per day
- **Rate**: 15 requests per minute
- **Cost**: $0.00

**Pay-As-You-Go (Paid Tier):**
- **Requests**: 2,000 per minute
- **Input**: $0.075 per 1M tokens (~$0.0001 per page)
- **Output**: $0.30 per 1M tokens
- **Cost per document**: ~$0.01 for a 100-page PDF

**To upgrade to paid tier:**
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Billing" in the sidebar
3. Set up a billing account
4. Your existing API key will automatically get higher limits

### OpenAI Whisper
- **Pricing**: $0.006 per minute of audio
- **Example**: 1 hour of audio = $0.36

## Advanced Features

### Custom Prompts
The OCR system uses carefully tuned prompts for:
- **Legal document extraction**: Preserves citations, case numbers, dates
- **Legal analysis**: Identifies favorable/adverse findings
- **Timeline extraction**: Auto-generates timeline events from dates

### Reprocessing Documents
You can click the OCR button again on already-processed documents to:
- Reprocess with updated AI models
- Fix extraction errors
- Update analysis with new case context

## Support

If you encounter issues:
1. Check Supabase function logs: `npx supabase functions logs ocr-document`
2. Verify all environment variables are set
3. Test with a simple document first (single-page PDF)
4. Contact support with specific error messages
