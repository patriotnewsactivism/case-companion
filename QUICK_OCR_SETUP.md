# Quick OCR Setup (2 Minutes)

## The Problem
- Google Gemini has low free limits (1,500/day)
- You're hitting rate limits with batch OCR

## The Solution
Add **OCR.space** as a free fallback (25,000 requests/month free!)

## Setup Steps

### 1. Get Free OCR.space API Key (1 minute)

1. Go to: **https://ocr.space/ocrapi**
2. Click **"Register for free API key"**
3. Fill out the form:
   - Name: Your name
   - Email: Your email
   - Website: `https://yourapp.com` (or just `http://localhost`)
4. Click **Submit**
5. Check your email for the API key
6. Copy the key (starts with `K8...`)

### 2. Configure Supabase (30 seconds)

```bash
# Set OCR.space as fallback OCR
npx supabase secrets set OCR_SPACE_API_KEY=K8xxxxxxxxx
```

### 3. Done!

That's it! Now your OCR system will:
1. Try Gemini first (best quality)
2. Automatically fall back to OCR.space if Gemini fails
3. Never run out of OCR (25,000 free requests/month!)

## How It Works

**Before (with just Gemini):**
```
OCR Request → Gemini → ❌ Rate Limit → FAIL
```

**After (with OCR.space fallback):**
```
OCR Request → Gemini → ❌ Rate Limit → OCR.space → ✅ SUCCESS
```

## Verify It's Working

1. Go to any case → Discovery tab
2. Click the Scan icon (📄) on a PDF
3. Check the browser console (F12)
4. You should see: `"Gemini rate limit exceeded, using OCR.space fallback"`
5. Document is processed successfully!

## Cost Comparison

| Provider | Free Tier | Paid Tier |
|----------|-----------|-----------|
| **Gemini** | 1,500/day | $0.075 per 1M tokens |
| **OCR.space** | 25,000/month | $30/month for 100k |
| **Both (Recommended)** | 26,500/month FREE | Best of both worlds |

## Troubleshooting

**"OCR service not configured"**
- Make sure you ran: `npx supabase secrets set OCR_SPACE_API_KEY=your-key`
- Verify with: `npx supabase secrets list`

**"All OCR providers failed"**
- Check you haven't exceeded 25,000 OCR.space requests this month
- File size must be under 5MB for OCR.space

**Quality concerns?**
- OCR.space quality is good but not as good as Gemini
- For best results, also set up Gemini (it tries Gemini first)
- Gemini gives you 1,500 high-quality OCRs per day

## Next Steps

**For Production Use:**
- **Upgrade Gemini** to paid tier for unlimited high-quality OCR
- **Keep OCR.space** as free fallback for reliability
- Total cost: ~$0.01 per 100-page PDF (very affordable)

**Check Usage:**
- OCR.space: https://ocr.space/ocrapi (login to see usage)
- Gemini: https://ai.dev/rate-limit

## Questions?

See full documentation: `OCR_SETUP.md`
