# SUPER PROMPT: Diagnose & Fix OCR + AI Document Analysis

## COPY EVERYTHING BELOW THIS LINE AND PASTE IT INTO YOUR AI CODING ASSISTANT

---

You are a senior full-stack engineer debugging and fixing a production legal-tech app called CaseBuddy. The app lets attorneys upload case documents (PDFs, images), automatically runs OCR to extract text, then uses AI to analyze the text (summary, key facts, timeline events, document classification). This entire pipeline is currently broken.

## THE PROBLEM

When a user uploads a document, it should:
1. Extract text (OCR for images/scanned PDFs, text-layer extraction for digital PDFs)
2. Send extracted text to an AI model for analysis (summary, key facts, entities, timeline events)
3. Save results to Supabase database
4. Update the UI with the analysis

Right now, **step 2 fails** because the Google Gemini API key has overdue billing and returns 403/429 errors. The app has NO working AI provider. We need to fix this using **free and trial-tier AI providers** so the app works immediately without payment.

## CURRENT ARCHITECTURE

### Three Vercel Serverless API Routes (in `/api/`):

1. **`api/chat.ts`** — Handles all AI chat requests. Provider chain: Gemini → OpenRouter → OpenAI. Receives both Gemini-format requests (body.contents + body.system_instruction) and OpenAI-format requests (body.messages).

2. **`api/ocr-document.ts`** — Receives a document URL or pre-extracted text, calls Gemini for AI analysis (summary, key facts, timeline events), saves to Supabase. Currently has OpenRouter fallback added but it may not work correctly.

3. **`api/evidence-analysis.ts`** — Analyzes evidence admissibility. Currently has OpenRouter fallback.

### Client-Side Flow (`src/hooks/useAutoAnalysis.ts`):

1. User uploads a document → stored in Supabase Storage
2. Hook tries **client-side PDF text extraction** first (using pdfjs-dist, free, no API needed)
3. Calls `supabase.functions.invoke('ocr-document', ...)` which is intercepted by `src/lib/functions-wrapper.ts`
4. The wrapper routes the call to `/api/ocr-document` (Vercel serverless function)
5. The serverless function calls Gemini for AI analysis → **THIS IS WHERE IT FAILS**
6. Results are saved to Supabase `documents` table (ocr_text, summary, key_facts, entities, timeline events)

### Functions Wrapper (`src/lib/functions-wrapper.ts`):

Intercepts `supabase.functions.invoke()` calls for AI functions and routes them to Vercel `/api/` endpoints instead of Supabase Edge Functions. Falls back to mock responses if the API fails. Maps function names to endpoints:
- `ocr-document` → `/api/ocr-document`
- `evidence-analysis` → `/api/evidence-analysis`  
- `chat`, `gemini-proxy`, `trial-assistant`, `document-aware-chat`, `trial-simulation`, `generate-motion` → `/api/chat`

### Supabase Edge Functions (in `supabase/functions/`):

There are 20+ edge functions that ALSO call Gemini directly using `Deno.env.get('GOOGLE_AI_API_KEY')`. A shared config at `supabase/functions/_shared/aiConfig.ts` handles provider selection with a priority chain: Gemini → OpenAI → OpenRouter. Many edge functions use `?key=${googleApiKey}` in URL params which breaks with the new `AQ.` prefix key format.

### Environment Variables:

Currently needed on Vercel:
- `GOOGLE_AI_API_KEY` — Overdue/billed, returns 403. Key format is `AQ.xxxxx` (new Google format, not the old `AIzaSyxxxxx`)
- `OPENROUTER_API_KEY` — NOT SET. This is the primary fix.
- `OPENAI_API_KEY` — NOT SET
- `AI_GATEWAY_MODEL` — Optional, controls which OpenRouter model to use
- `SUPABASE_URL` — Set
- `SUPABASE_ANON_KEY` — Set
- `VITE_SUPABASE_URL` — Set (client-side)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Set (client-side)

## WHAT TO DIAGNOSE AND FIX

### Phase 1: Diagnose the Failure Points

1. **Read all three API files** (`api/chat.ts`, `api/ocr-document.ts`, `api/evidence-analysis.ts`) and identify every place where:
   - The code returns an error instead of falling back
   - The code requires `GOOGLE_AI_API_KEY` to be set (hard requirement with no bypass)
   - The Gemini-format path doesn't have a fallback chain
   - The OpenRouter fallback exists but might not work (wrong model names, missing error handling, format conversion issues)

2. **Read `src/lib/functions-wrapper.ts`** and verify:
   - All AI function names are in the `AI_FUNCTIONS` set
   - The endpoint mapping is correct
   - The mock fallback doesn't silently swallow real errors
   - The wrapper properly forwards the user's JWT for RLS

3. **Read `src/hooks/useAutoAnalysis.ts`** and verify:
   - Client-side PDF extraction works independently of the API
   - When the API fails but client-side text was extracted, it still saves the text to the database
   - Error messages are propagated to the UI (not silently swallowed)

4. **Read `supabase/functions/_shared/aiConfig.ts`** and check:
   - Whether the provider chain actually falls through correctly when Gemini returns 403
   - Whether the `?key=` URL param issue is present in edge functions
   - Whether OpenRouter is properly configured as the second fallback

### Phase 2: Fix the AI Provider Chain (Priority: Make it work for FREE)

**The goal: Make OCR + AI analysis work using only free/trial AI providers, no Google Gemini required.**

#### Fix 1: Make OpenRouter the PRIMARY provider when Gemini is unavailable

Update all three API files (`api/chat.ts`, `api/ocr-document.ts`, `api/evidence-analysis.ts`) so that:

- If `GOOGLE_AI_API_KEY` is not set OR Gemini returns an error (403, 429, 500, etc.), automatically fall through to OpenRouter
- If `OPENROUTER_API_KEY` is not set, fall through to the next provider
- If NO provider keys are set, return a clear error message telling the user which env vars to set
- Never crash or hang — always return a response (even if it's an error)

#### Fix 2: Use the best free OpenRouter models

Check https://openrouter.ai/api/v1/models for currently available free models. Good candidates:
- `nvidia/nemotron-3-super-120b-a12b:free` (1M context, strong)
- `google/gemma-4-31b-it:free` (262K context)
- `openrouter/free` (auto-routed to best available free model)
- Also consider very cheap models as backup (under $0.01/M tokens):
  - `google/gemini-3.1-flash-lite` ($0.00025/M tokens — essentially free for small docs)

For OCR/AI analysis, the model needs to:
- Accept long text inputs (legal documents can be 50+ pages)
- Return structured JSON (summary, key facts, timeline events)
- Follow complex instructions about legal document analysis

Use a model with at least 128K context. Set it via `AI_GATEWAY_MODEL` env var with a sensible default.

#### Fix 3: Add Tesseract.js as a FREE server-side OCR fallback

The client-side pdfjs extraction handles digital PDFs. For scanned PDFs and images, add Tesseract.js (`npm install tesseract.js`) as a server-side OCR fallback in `api/ocr-document.ts` when no text is provided and the file is an image or scanned PDF.

Also consider:
- **Google Cloud Vision** (1K free/month, needs `GCV_API_KEY`)
- **OCR.space API** (25K free calls/month, no credit card, needs `OCR_SPACE_API_KEY`)

#### Fix 4: Fix the Supabase Edge Functions

The edge functions in `supabase/functions/` also call Gemini directly. Update `supabase/functions/_shared/aiConfig.ts` to:
- Replace all `?key=${googleApiKey}` URL params with `x-goog-api-key` header
- Make OpenRouter the default when `GOOGLE_AI_API_KEY` is not set or returns errors
- Add proper error handling that falls through providers instead of throwing

### Phase 3: Add Graceful Degradation

The app should work at multiple levels even if AI is completely unavailable:

1. **Level 3 (Full AI)**: All providers work → full analysis (summary, key facts, timeline, entities)
2. **Level 2 (Text only)**: AI fails but OCR succeeds → save extracted text, skip AI analysis, show "AI analysis pending" in UI
3. **Level 1 (Client extraction only)**: Server fails entirely → save client-side extracted PDF text, mark as "processing incomplete"
4. **Level 0 (Nothing works)**: Show clear error to user with instructions

Make sure `useAutoAnalysis.ts` handles all 4 levels gracefully.

### Phase 4: Test the Pipeline

After all fixes, test the complete flow:
1. Upload a digital PDF → should extract text client-side, then AI analysis via OpenRouter
2. Upload a scanned PDF/image → should OCR via Tesseract.js, then AI analysis via OpenRouter
3. Simulate Gemini being down (unset `GOOGLE_AI_API_KEY`) → everything should still work via OpenRouter
4. Simulate all AI being down (unset all keys) → text should still be extracted and saved, with a clear "AI analysis unavailable" message

## KEY FILES TO READ AND MODIFY

```
api/chat.ts                          — AI chat endpoint (Gemini → OpenRouter → OpenAI)
api/ocr-document.ts                  — OCR + AI analysis endpoint
api/evidence-analysis.ts             — Evidence analysis endpoint
src/lib/functions-wrapper.ts         — Routes edge function calls to Vercel /api/ endpoints
src/hooks/useAutoAnalysis.ts         — Client-side hook that orchestrates the pipeline
src/lib/ocr/pdf-text-extractor.ts    — Client-side PDF text extraction (pdfjs-dist)
src/services/documentIntelligence.ts — Auto-naming/classification of documents
supabase/functions/_shared/aiConfig.ts — Shared AI config for edge functions
vercel.json                          — Vercel config (ensure /api routes are excluded from SPA rewrite)
.env.production                      — Environment variables (VITE_ prefixed = client-side)
package.json                         — Dependencies
```

## ENVIRONMENT VARIABLES TO SET ON VERCEL

After the code fixes, set these in Vercel → Settings → Environment Variables:

### REQUIRED (get the app working for free):
```
OPENROUTER_API_KEY=sk-or-v1-xxxxx     ← Get FREE key at https://openrouter.ai/keys
AI_GATEWAY_MODEL=nvidia/nemotron-3-super-120b-a12b:free  ← or another free model
```

### OPTIONAL (improve quality when budget allows):
```
GOOGLE_AI_API_KEY=AQ.xxxxx            ← When Google billing is restored
OPENAI_API_KEY=sk-xxxxx               ← As another fallback
GCV_API_KEY=xxxxx                     ← Google Cloud Vision for better OCR
OCR_SPACE_API_KEY=xxxxx               ← OCR.space as another OCR fallback
```

### ALREADY SET:
```
SUPABASE_URL=https://xoobydcfktjyzidhhjca.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_URL=https://xoobydcfktjyzidhhjca.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_GOOGLE_CLIENT_ID=655270862994-xxxxx.apps.googleusercontent.com
```

## CONSTRAINTS

- **No paid API keys right now.** Google Gemini billing is overdue. Use free tiers only.
- **Vercel serverless functions** have a 10-second timeout on the Hobby plan and 60-second on Pro. OCR + AI analysis of large documents may timeout. Handle this gracefully.
- **The app is live in production** at casebuddy.live. Don't break existing functionality.
- **Supabase Edge Functions** run on Deno and are deployed separately. They also need the same provider chain fix.
- **Client-side extraction** using pdfjs-dist already works for digital PDFs. Don't break it.
- **The `AQ.` prefix** on the Google API key is the new format. It works with `x-goog-api-key` header but NOT with `?key=` URL params (the period breaks URL parsing).

## SUCCESS CRITERIA

After all fixes:
1. ✅ Uploading a digital PDF extracts text and runs AI analysis — even with NO Google Gemini key
2. ✅ Uploading a scanned PDF/image runs OCR (Tesseract.js) and AI analysis — even with NO Google Gemini key
3. ✅ AI chat works via OpenRouter free models
4. ✅ Evidence analysis works via OpenRouter free models
5. ✅ If all AI providers fail, extracted text is still saved to the database with a clear "AI pending" status
6. ✅ The UI shows meaningful error messages, not silent failures
7. ✅ The Supabase Edge Functions also fall back to OpenRouter when Gemini is unavailable
8. ✅ No hardcoded API keys in the code (all via env vars)

## IMPORTANT NOTES

- The OpenRouter free model names change frequently. The code should handle 404 errors (model not found) and fall back to alternative free models automatically.
- OpenRouter free models may have rate limits (e.g., 20 req/min). Add retry with backoff.
- For very large documents (100+ pages), consider chunking the text before sending to the AI model.
- The `response_format: { type: 'json_object' }` parameter may not be supported by all OpenRouter models. Handle non-JSON responses gracefully by attempting to extract JSON from text.
- Tesseract.js is slow (10-30 seconds per page). Show a progress indicator. Consider running it in a Web Worker on the client side instead of the server to avoid Vercel timeouts.

Start by reading all the key files listed above, then systematically fix each issue. Test after each change. Provide clear instructions for what env vars to set on Vercel.
