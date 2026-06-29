# SUPER PROMPT v2: Diagnose & Fix OCR + AI Document Analysis

## COPY EVERYTHING BELOW THIS LINE AND PASTE IT INTO YOUR AI CODING ASSISTANT

---

You are a senior full-stack engineer debugging and fixing a production legal-tech app called CaseBuddy (casebuddy.live). The app lets attorneys upload case documents (PDFs, images), automatically runs OCR to extract text, then uses AI to analyze the text (summary, key facts, timeline events, document classification). This entire pipeline is currently broken because Google Gemini billing is overdue.

## THE PROBLEM

Google Gemini API returns 403 (billing overdue) or 429 (rate limited). The app has no working AI provider. We need to fix it using **free and trial-tier AI providers** — primarily OpenRouter free models — so the app works immediately without paying Google.

## ACTUAL ARCHITECTURE (IMPORTANT — read carefully)

### No Vercel /api/ routes exist. All AI goes through Supabase Edge Functions.

The client app (React/Vite, deployed on Vercel) calls **Supabase Edge Functions** directly via `fetch()` to `${VITE_SUPABASE_URL}/functions/v1/{functionName}`. There are NO Vercel serverless API routes. The `api/` directory does not exist in the repo.

### Client-Side Flow (`src/hooks/useAutoAnalysis.ts`):

1. User uploads document → stored in Supabase Storage
2. Hook calls `fetch(${VITE_SUPABASE_URL}/functions/v1/ocr-document)` with JWT auth
3. The edge function does: OCR (text extraction) → AI analysis (summary, key facts, timeline) → saves to Supabase DB
4. Client runs `documentIntelligence` for auto-naming/classification
5. No client-side PDF text extraction — all OCR happens server-side in the edge function

### `src/lib/functions-wrapper.ts`:

A thin wrapper around `supabase.functions.invoke()`. It does NOT route to Vercel /api/ endpoints. It does NOT have mock fallback. It just calls Supabase Edge Functions directly and throws on error.

### `src/sandbox/mock-ai.ts`:

DEPRECATED. Exports nothing (`export {}`). Not imported anywhere. Safe to ignore.

### Supabase Edge Functions (in `supabase/functions/`):

There are 30+ edge functions running on Deno. The AI-related ones fall into THREE categories:

#### Category A: Uses shared `aiConfig.ts` (has provider chain but BROKEN)
These import `getAIProvider()`, `getDocumentAIProvider()`, `getFastAIProvider()`, or `callChatCompletion()` from `supabase/functions/_shared/aiConfig.ts`:
- `chat` — AI chat (uses `getFastAIProvider()`)
- `document-aware-chat` — Chat with document context
- `cross-document-analysis` — Cross-document analysis
- `mock-jury` — Mock jury deliberation
- `synthesize-timeline` — Timeline synthesis
- `trial-assistant` — Trial assistant
- `voice-agent-call` — Voice agent

**BUG in aiConfig.ts:** The `callChatCompletion()` function only retries on 404 and 503 (model not found / unavailable). When Gemini returns **403 (billing overdue)** or **429 (rate limited)**, it THROWS immediately instead of falling through to the next provider. The `getAIProvider()` function picks Gemini first if `GOOGLE_AI_API_KEY` is set — so even with `OPENROUTER_API_KEY` configured, Gemini is always tried first and fails hard on 403.

#### Category B: Calls Gemini directly with `?key=` URL param (BROKEN with AQ. keys)
These use `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=${googleApiKey}` — the `?key=` URL param is **BROKEN** with the new `AQ.` prefix keys because the period in the key breaks URL parsing. Must use `x-goog-api-key` header instead:
- `gemini-proxy` — 1 `?key=` usage, **NO OpenRouter fallback at all**
- `trial-coach` — 1 `?key=` usage, **NO OpenRouter fallback**
- `trial-simulation` — 1 `?key=` usage, **NO OpenRouter fallback**
- `ocr-document` — 2 `?key=` usages (OCR step), has OpenRouter fallback for analysis but NOT for OCR
- `ocr-queue-processor` — 3 `?key=` usages, has OpenRouter fallback for analysis

#### Category C: Calls Gemini via OpenAI-compatible endpoint (uses Bearer auth, works with AQ. keys)
These use `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` with `Authorization: Bearer ${apiKey}` header. This works fine with `AQ.` prefix keys. They have their own provider chains:
- `argument-analyzer` — Has Gemini → OpenRouter fallback
- `case-strategy` — Has Gemini → OpenRouter fallback
- `discovery-response` — Has Gemini → OpenRouter fallback
- `evidence-analysis` — Has Gemini → OpenRouter fallback
- `judicial-research` — Has Gemini → OpenRouter fallback
- `privilege-log` — Has Gemini → OpenRouter fallback
- `settlement-analysis` — Has Gemini → OpenRouter fallback
- `witness-prep` — Has Gemini → OpenRouter fallback

**BUG in Category C:** Even though they have OpenRouter fallback, Gemini is tried FIRST. When Gemini returns 403, these functions may or may not fall through correctly — some throw on non-200 responses without trying the next provider.

### `vercel.json`:
Has a catch-all rewrite `"/(.*)" → "/index.html"`. This is fine because there are no /api/ routes — all AI goes through Supabase Edge Functions.

## WHAT TO FIX (in priority order)

### Fix 1 (CRITICAL): Fix `aiConfig.ts` to fall through on 403/429

File: `supabase/functions/_shared/aiConfig.ts`

The `callChatCompletion()` function currently only retries on 404/503 for Gemini model cycling. It needs to also:
- On **403** (billing overdue): Skip to the next provider (OpenRouter) instead of throwing
- On **429** (rate limited): Retry with backoff, then fall through to next provider
- On **500/502/503** (server error): Fall through to next provider

The `getAIProvider()` function should also be updated so that if `OPENROUTER_API_KEY` is set but `GOOGLE_AI_API_KEY` is NOT set, OpenRouter becomes the primary (this already works, but needs to also work when Gemini is set but broken).

Best approach: Add a `callChatWithFallback()` function that tries `getAIProvider()` first, catches 403/429/500 errors, and falls through to OpenRouter, then OpenAI.

### Fix 2 (CRITICAL): Replace `?key=` URL params with `x-goog-api-key` header

Files to fix (5 edge functions):
- `supabase/functions/gemini-proxy/index.ts` — line 21
- `supabase/functions/trial-coach/index.ts` — line 244
- `supabase/functions/trial-simulation/index.ts` — line 523
- `supabase/functions/ocr-document/index.ts` — lines 759, 805
- `supabase/functions/ocr-queue-processor/index.ts` — lines 314, 344, 586

Replace:
```ts
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;
fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ... })
```

With:
```ts
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': googleApiKey }, body: ... })
```

### Fix 3 (CRITICAL): Add OpenRouter fallback to functions that have NONE

Files:
- `supabase/functions/gemini-proxy/index.ts` — Currently hard-fails if `GOOGLE_AI_API_KEY` is missing or Gemini fails. Add OpenRouter fallback that converts Gemini format ↔ OpenAI format.
- `supabase/functions/trial-coach/index.ts` — Same issue. Add OpenRouter fallback.
- `supabase/functions/trial-simulation/index.ts` — Same issue. Add OpenRouter fallback.
- `supabase/functions/chat/index.ts` — Uses `getFastAIProvider()` from aiConfig but when the fetch fails, returns 500 with no retry. Add fallback to try OpenRouter directly.

### Fix 4 (HIGH): Make Category C functions fall through correctly on 403

Files: `argument-analyzer`, `case-strategy`, `discovery-response`, `evidence-analysis`, `judicial-research`, `privilege-log`, `settlement-analysis`, `witness-prep`

Each of these has a provider selection block like:
```ts
if (GOOGLE_AI_API_KEY) {
  apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  apiKey = GOOGLE_AI_API_KEY;
  model = "gemini-2.0-flash";
} else if (OPENROUTER_API_KEY) {
  apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  ...
}
```

The problem: if `GOOGLE_AI_API_KEY` is set (it is, with the overdue billing), Gemini is selected. When the fetch returns 403, most of these functions just return the error — they don't retry with OpenRouter.

Fix: Wrap the fetch in a try/catch. On 403 or 429, retry with OpenRouter. On success, return. Pattern:

```ts
let response = await fetch(apiUrl, { ... });
if (!response.ok && (response.status === 403 || response.status === 429) && OPENROUTER_API_KEY && apiUrl.includes('generativelanguage')) {
  // Fall through to OpenRouter
  apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  apiKey = OPENROUTER_API_KEY;
  model = AI_GATEWAY_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
  response = await fetch(apiUrl, { ... });
}
```

### Fix 5 (MEDIUM): Fix the OCR step in `ocr-document` to fall back when Gemini fails

The `ocr-document` edge function uses Gemini for OCR (vision/text extraction from images and scanned PDFs). When Gemini fails (403), there's no OCR fallback — only the analysis step has OpenRouter fallback.

Options for free OCR fallback:
- **OCR.space** (25K free calls/month) — already supported in the code via `OCR_SPACE_API_KEY`, but needs to be set as a Supabase secret
- **Tesseract.js** — runs in Deno, fully free, but slow (10-30s per page) and may hit serverless memory limits
- The code already has Tier 0 (PDF embedded text), Tier 1 (Gemini), Tier 4 (OCR.space). Tiers 2-3 were removed. Just ensure OCR.space is configured.

### Fix 6 (MEDIUM): Add graceful degradation to `useAutoAnalysis.ts`

The client-side hook should handle the case where the edge function fails entirely:
- Save whatever text is available (even if AI analysis fails)
- Show a clear "AI analysis pending" status in the UI
- Don't silently swallow errors — surface them to the user

Currently the hook throws on any error and marks the queue item as "failed".

## ENVIRONMENT VARIABLES (Supabase Secrets)

After the code fixes, set these via `npx supabase secrets set KEY=VALUE`:

### REQUIRED (to get AI working for free):
```bash
npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-xxxxx
npx supabase secrets set AI_GATEWAY_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

### OPTIONAL (for OCR fallback):
```bash
npx supabase secrets set OCR_SPACE_API_KEY=K12345678  # Get free key at https://ocr.space/ocrapi
```

### ALREADY SET (but broken — overdue billing):
```bash
# GOOGLE_AI_API_KEY is set but returns 403. Once billing is restored, it will work again.
```

### GET OPENROUTER FREE KEY:
1. Go to https://openrouter.ai/
2. Create an account (free, no credit card)
3. Go to https://openrouter.ai/keys
4. Create a new key
5. Copy the key (starts with `sk-or-v1-`)

## KEY FILES TO READ AND MODIFY

```
supabase/functions/_shared/aiConfig.ts          — SHARED provider config (fix 403/429 handling)
supabase/functions/ocr-document/index.ts         — OCR + AI analysis (fix ?key= + add OCR fallback)
supabase/functions/ocr-queue-processor/index.ts  — Queue-based OCR (fix ?key=)
supabase/functions/gemini-proxy/index.ts         — Gemini proxy (fix ?key= + add OpenRouter fallback)
supabase/functions/trial-coach/index.ts          — Trial coach (fix ?key= + add OpenRouter fallback)
supabase/functions/trial-simulation/index.ts     — Trial simulation (fix ?key= + add OpenRouter fallback)
supabase/functions/chat/index.ts                 — Chat (add fallback when getFastAIProvider fails)
supabase/functions/evidence-analysis/index.ts    — Evidence analysis (fix 403 fallthrough)
supabase/functions/argument-analyzer/index.ts    — Argument analyzer (fix 403 fallthrough)
supabase/functions/case-strategy/index.ts        — Case strategy (fix 403 fallthrough)
supabase/functions/discovery-response/index.ts   — Discovery response (fix 403 fallthrough)
supabase/functions/judicial-research/index.ts    — Judicial research (fix 403 fallthrough)
supabase/functions/privilege-log/index.ts        — Privilege log (fix 403 fallthrough)
supabase/functions/settlement-analysis/index.ts  — Settlement analysis (fix 403 fallthrough)
supabase/functions/witness-prep/index.ts         — Witness prep (fix 403 fallthrough)
src/hooks/useAutoAnalysis.ts                     — Client-side hook (add graceful degradation)
vercel.json                                      — Vercel config (no changes needed)
```

## CONSTRAINTS

- **No paid API keys.** Google Gemini billing is overdue. Use OpenRouter free models.
- **Supabase Edge Functions** run on Deno with a 150-second timeout and 128MB memory limit.
- **The app is live in production** at casebuddy.live. Don't break existing functionality.
- **The `AQ.` prefix** on the Google API key works with `Authorization: Bearer` header and `x-goog-api-key` header, but NOT with `?key=` URL params.
- **Do NOT create Vercel /api/ routes.** All AI goes through Supabase Edge Functions.
- **Do NOT modify `functions-wrapper.ts`** — it's a thin wrapper, not a routing layer.
- **OpenRouter free models** may have rate limits (20 req/min). Add retry with backoff.
- **OpenRouter free model names change frequently.** Handle 404 (model not found) by trying alternative free models.

## SUCCESS CRITERIA

After all fixes:
1. ✅ `aiConfig.ts` falls through to OpenRouter when Gemini returns 403/429
2. ✅ All `?key=` URL params replaced with `x-goog-api-key` header
3. ✅ `gemini-proxy`, `trial-coach`, `trial-simulation` have OpenRouter fallback
4. ✅ `chat` edge function retries with OpenRouter on Gemini failure
5. ✅ All Category C functions (evidence-analysis, argument-analyzer, etc.) fall through to OpenRouter on 403
6. ✅ OCR works via OCR.space when Gemini is unavailable (if `OCR_SPACE_API_KEY` is set)
7. ✅ AI analysis works via OpenRouter free models when Gemini is unavailable
8. ✅ Client-side `useAutoAnalysis.ts` handles failures gracefully (saves text, shows "AI pending")
9. ✅ No hardcoded API keys — all via Supabase secrets
10. ✅ App works end-to-end with ONLY `OPENROUTER_API_KEY` set (no Google key needed)

## STEP-BY-STEP EXECUTION ORDER

1. Read `supabase/functions/_shared/aiConfig.ts` — understand the provider chain
2. Fix `aiConfig.ts` — add 403/429 fallthrough to OpenRouter
3. Read and fix the 5 edge functions with `?key=` URL params → switch to `x-goog-api-key` header
4. Read and fix `gemini-proxy`, `trial-coach`, `trial-simulation` — add OpenRouter fallback
5. Read and fix `chat` — add OpenRouter fallback when `getFastAIProvider()` fails
6. Read and fix the 8 Category C functions — add 403 fallthrough to OpenRouter
7. Read and fix `useAutoAnalysis.ts` — add graceful degradation
8. Test: set `OPENROUTER_API_KEY` as Supabase secret, deploy edge functions, upload a document
9. Verify: OCR extracts text, AI analysis produces summary/key facts/timeline via OpenRouter

Start by reading `aiConfig.ts` and the `ocr-document` edge function to understand the current flow, then fix each issue systematically.
