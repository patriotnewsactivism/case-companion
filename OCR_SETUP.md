# OCR Setup Guide

This guide explains how to set up and use the OCR (Optical Character Recognition) functionality in CaseBuddy Professional.

## Overview

The OCR system uses **Google's Gemini 2.5 Flash AI** to extract text from:
- **PDF documents** (all pages)
- **Images** (JPG, PNG, GIF, WebP, BMP, TIFF)
- **Text files** (TXT, DOC, DOCX)

After extracting text, the system automatically:
1. Performs legal document analysis
2. Extracts key facts, favorable/adverse findings, and action items
3. Generates timeline events from dates found in the document
4. Creates a summary of the document

## Setup Instructions

### 1. Get Google AI API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Select a Google Cloud project (or create a new one)
4. Copy the generated API key

### 2. Configure Supabase Secret

```bash
# Set the Google AI API key as a Supabase secret
npx supabase secrets set GOOGLE_AI_API_KEY=your-actual-api-key-here
```

### 3. Verify Configuration

```bash
# List secrets to verify it's set
npx supabase secrets list
```

You should see `GOOGLE_AI_API_KEY` in the list.

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

### Rate Limit Error: "Google AI API rate limit exceeded"
This means you've hit your daily or per-minute quota.

**Free Tier Limits:**
- 1,500 requests per day
- 15 requests per minute

**Solutions:**
1. **Wait 24 hours** for the daily quota to reset
2. **Wait 1 minute** if you hit the per-minute limit
3. **Upgrade to paid tier** at [Google AI Studio](https://aistudio.google.com/) for 2,000 requests/minute
4. **Process documents individually** instead of batch processing
5. **Monitor usage** at https://ai.dev/rate-limit

**To upgrade (recommended for production):**
- Go to Google AI Studio → Billing
- Set up a billing account
- Cost: ~$0.01 per 100-page PDF (very affordable)

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

### Google AI (OCR)
**Free Tier Limits (Gemini 1.5 Flash):**
- **Daily limit**: 1,500 requests per day
- **Per-minute limit**: 15 requests per minute
- **User limit in app**: 10 OCR operations per minute per user
- **Service role**: No limit (used for batch imports)
- **File size limit**: ~20MB (Google AI API limit)

**IMPORTANT**: If you hit the daily limit (20 requests/day on free tier), you'll see:
> "Google AI API rate limit exceeded. Please wait a few minutes or upgrade your API plan"

**Solutions:**
1. **Wait**: Free tier resets every 24 hours
2. **Upgrade to Pay-As-You-Go**: Go to [Google AI Studio](https://aistudio.google.com/) → Billing
3. **Batch process slowly**: Process documents one at a time instead of using "Analyze All"

### OpenAI Whisper (Transcription)
- **User limit**: 5 transcriptions per minute per user
- **File size limit**: 25MB (Whisper API limit)

## Cost Considerations

### Google AI Gemini 1.5 Flash
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
