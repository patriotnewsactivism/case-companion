# CaseBuddy Suite — Cross-App Integration Contract

This document is the **source of truth** for how the three CaseBuddy apps interoperate.
It lives in `case-companion` but describes the shared contract all three must honor.
Keep it in sync across repos; drift here is what breaks the "sync" between apps.

## The three apps

| App | Role | Primary output |
| --- | --- | --- |
| **casebuddy-ai-law-partner** | Autonomous "agentic law firm" — start-to-end case management and full automation toward the best outcome. | Actions, generated filings, strategy, task orchestration. |
| **case-companion** (this repo) | Personalized, hands-on tool for a single attorney or pro se litigant/defendant to manage their case(s). | Manual case management, requests, timeline, trial prep. |
| **casebuddy-discoverylens** | Precision document engine — extracts key data from each document, stores it for retrieval, intelligently renames files (e.g. `2026-03-15-Motion-to-Dismiss-ReardonvGalveston`), and assigns Bates numbers. | Clean, renamed, Bates-stamped, analyzed `documents` rows + files. |

**Data flow:** DiscoveryLens is the ingestion/extraction front-end. Its documents and
analysis sync into case-companion and/or ai-law-partner "with one click." ai-law-partner
automates across the same data. case-companion is the human-driven cockpit over that data.

## Sync architecture: the database *is* the sync layer

All three apps point at **one shared Supabase project** (`plcvjadartxntnurhcua`).
Because they share:

1. **Auth** — the same `auth.users` (one login / SSO across the suite), and
2. **Schema + RLS** — every row is scoped by `auth.uid() = user_id` (directly or via the
   owning `cases` row),

…a row written by any app is **immediately visible to the others** for that user. There is
no replication or webhook layer to maintain. "One-click sync" = write to the shared tables
under the same `user_id` + `case_id` using the conventions below.

> The only thing that breaks this is **schema drift**. If one app expects a column another
> doesn't write, sync silently degrades. Treat the schema below as a shared contract and
> change it only via migrations coordinated across repos.

## Canonical shared tables

Owned/defined here in `case-companion/supabase/migrations`. Other apps should read/write
these exact shapes (not divergent copies).

### `cases` — the unit of collaboration
`id, user_id, name, case_number, case_type, client_name, opposing_party, court, status, …`
Everything else hangs off `case_id`. RLS: `auth.uid() = user_id`.

### `documents` — DiscoveryLens's primary sync target
```
id, case_id, user_id,
name TEXT,                 -- DiscoveryLens writes the intelligently-renamed title here
file_url TEXT,             -- storage path in the shared bucket (see Storage)
file_type, file_size,
bates_number TEXT,         -- DiscoveryLens assigns; case-companion/ai-law-partner display
summary TEXT,              -- analysis fields (shared shape across apps)
key_facts TEXT[], favorable_findings TEXT[], adverse_findings TEXT[], action_items TEXT[],
ai_analyzed BOOLEAN,
ocr_text TEXT,             -- extracted full text (added by later migration)
document_type TEXT,        -- classification
source_app TEXT,           -- provenance: 'casebuddy-discoverylens' | 'case-companion' | 'casebuddy-ai-law-partner'
created_at, updated_at
```
**DiscoveryLens → suite contract:** to "send a document" into case-companion / ai-law-partner,
insert a `documents` row under the target `user_id` + `case_id` with:
`name` = renamed title, `file_url` = shared-bucket path, `bates_number`, the analysis fields,
and `source_app = 'casebuddy-discoverylens'`. It appears instantly in the other apps.

### `timeline_events` — the unified "smart timeline"
```
id, case_id, user_id, title, description, event_date, event_type, importance,
event_category, is_ai_generated, next_required_action, legal_significance, entities JSONB,
linked_document_id UUID,      -- ties an event to a document
source_request_id UUID,       -- ties an event to an outbound_requests row (case-companion)
source_app TEXT,              -- provenance
created_at, updated_at
```
All three apps contribute events here. case-companion adds **request-lifecycle** events
(sent / response-due / responded — see `src/lib/outbound-requests-api.ts:syncRequestTimeline`)
and **document-derived** events (from `ocr-document`). The `synthesize-timeline` edge function
performs cross-document dedup/ordering/phase assignment over the merged feed, so any app's
events are folded into one clean timeline.

### `outbound_requests` — outbound requests tracker (added by case-companion)
Public-records/FOIA requests, discovery demands, preservation letters, subpoenas, with
statutory-deadline tracking. `source_app` marks origin. Shared so ai-law-partner can
automate follow-ups and DiscoveryLens can attach responsive documents via `case_id`.

### `discovery_requests` — inbound discovery responder (existing)
Incoming interrogatories/RFPs/RFAs the user answers. Distinct from `outbound_requests`.

## Storage conventions (shared bucket)

Bucket **`case-documents`**, path **`{user_id}/{case_id}/{timestamp}.{ext}`**.
RLS on `storage.objects` keys off `(storage.foldername(name))[1] = auth.uid()`.
DiscoveryLens must upload into this bucket with this path so files are retrievable from any
app, and set `documents.file_url` to that path. Using a different bucket/path breaks retrieval.

## Reusable edge-function contracts

These run on the shared project and are callable by any app (all `verify_jwt = true`):

- **`ocr-document`** — OCR + legal analysis → writes `summary/key_facts/favorable/adverse/action_items` and extracts `timeline_events`. DiscoveryLens's extraction should target the same output fields so analysis is portable.
- **`generate-request`** — drafts an outbound request (FOIA / discovery demand / preservation / subpoena) from case context + jurisdiction. Input `{ caseId, requestCategory, requestSubtype, jurisdiction, statuteReference, recordsSought, recipient* }` → `{ content, statuteReference }`.
- **`synthesize-timeline`** — cross-document timeline synthesis over `timeline_events`.
- **`export-document`** / **`send-email`** — shared export (PDF/HTML) and Resend email.

## Provenance & the "one-click sync" UX

- Every shared write should set `source_app` to its own identifier.
- To surface "Imported from DiscoveryLens" in case-companion, read `documents.source_app`.
- Because the DB is shared, the "sync" button in DiscoveryLens is just: (a) ensure the file is
  in the shared bucket, (b) upsert the `documents` row under the target `case_id`. No cross-app
  API call is required.

## Keeping the three repos from drifting (checklist)

- [ ] All three point at Supabase project `plcvjadartxntnurhcua` (same `VITE_SUPABASE_*`).
- [ ] Schema changes to shared tables land as migrations **here** first, then the other repos
      regenerate types (`supabase gen types typescript`).
- [ ] Analysis fields keep the **same names/shape** (`summary`, `key_facts`, `favorable_findings`,
      `adverse_findings`, `action_items`, `ai_analyzed`, `document_type`, `ocr_text`).
- [ ] All shared writes set `user_id` (and `case_id` where applicable) so RLS + sync work.
- [ ] Files go to the `case-documents` bucket with the `{user_id}/{case_id}/…` path.
- [ ] Each app stamps `source_app` on shared rows.

## Open items to confirm with the other repos

- Confirm ai-law-partner and DiscoveryLens actually target `plcvjadartxntnurhcua` (not separate
  projects). If separate, we need a sync/replication layer instead of the shared-DB model above.
- Align DiscoveryLens's renaming output to the `documents.name` field and Bates format to
  `documents.bates_number` (case-companion's `BatesManager` already reads this).
- Decide whether ai-law-partner writes `outbound_requests` directly (recommended) to automate
  request follow-ups on the shared timeline.
