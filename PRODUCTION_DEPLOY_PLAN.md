# CaseBuddy Professional - Production Deployment Plan

## Executive Summary

This document outlines the complete production deployment strategy for CaseBuddy Professional, incorporating findings from comprehensive security, performance, and architecture audits conducted by multiple AI agents.

**Current Status:** Development/Staging
**Target State:** Production-Ready with Enterprise Security
**Estimated Timeline:** 2-3 weeks (10-15 development days)
**Risk Level:** HIGH (23 security vulnerabilities, 27 performance issues identified)

---

## Phase 1: Critical Security Fixes (Days 1-5)

### Priority 1A: Storage Security (DAY 1)
**CRITICAL - Public Document Exposure**

**Issue:** All documents in `case-documents` bucket are publicly accessible without authentication.

**Fix Steps:**
1. Update storage bucket policy:
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_secure_storage_bucket.sql

-- Remove public access
UPDATE storage.buckets
SET public = false
WHERE id = 'case-documents';

-- Add RLS policies for authenticated access only
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload to their own folders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

2. Update file URL generation in frontend:
```typescript
// src/lib/api.ts
export async function getSecureFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
```

**Testing:** Verify unauthorized users cannot access document URLs.

---

### Priority 1B: Edge Function Authentication (DAY 2)

**Fix All Edge Functions:**

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { authorized: false, user: null, error: 'No authorization header' };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false, user: null, error: error?.message || 'Unauthorized' };
  }

  return { authorized: true, user, supabase };
}

export function unauthorizedResponse(message: string = 'Unauthorized') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

**Apply to ocr-document function:**
```typescript
// supabase/functions/ocr-document/index.ts
import { verifyAuth, unauthorizedResponse } from '../_shared/auth.ts';

serve(async (req) => {
  const { authorized, user, supabase } = await verifyAuth(req);
  if (!authorized) {
    return unauthorizedResponse();
  }

  // Verify document ownership
  const { documentId } = await req.json();
  const { data: doc, error } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (error || doc.user_id !== user.id) {
    return new Response(
      JSON.stringify({ error: 'Document not found or access denied' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Proceed with OCR...
});
```

**Repeat for:** transcribe-media, create-video-room, join-video-room

---

### Priority 1C: Input Validation & SQL Injection Prevention (DAY 3)

**Add validation utilities:**

```typescript
// supabase/functions/_shared/validation.ts
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const UUIDSchema = z.string().uuid();
export const FolderIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);
export const FilePathSchema = z.string().max(1024).regex(/^[a-zA-Z0-9_\-\/. ]+$/);

export function validateUUID(value: string, fieldName: string = 'id'): string {
  const result = UUIDSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
  return result.data;
}

export function sanitizeFilePath(path: string): string {
  // Remove path traversal attempts
  const sanitized = path.replace(/\.\./g, '').replace(/\/\//g, '/');

  const result = FilePathSchema.safeParse(sanitized);
  if (!result.success) {
    throw new Error('Invalid file path: contains illegal characters');
  }

  return result.data;
}

export function validateGoogleDriveFolderId(folderId: string): string {
  const result = FolderIdSchema.safeParse(folderId);
  if (!result.success) {
    throw new Error('Invalid Google Drive folder ID format');
  }
  return result.data;
}
```

**Apply validation to import-google-drive:**
```typescript
import { validateUUID, validateGoogleDriveFolderId, sanitizeFilePath } from '../_shared/validation.ts';

const handler = async (req: Request): Promise<Response> => {
  // ... auth ...

  const requestBody = await req.json();

  // Validate all inputs
  const caseId = validateUUID(requestBody.caseId, 'caseId');
  const folderId = validateGoogleDriveFolderId(requestBody.folderId);
  const folderPath = sanitizeFilePath(requestBody.folderPath);

  // Validate case ownership using parameterized query (already safe with Supabase)
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('user_id', user.id)
    .single();

  // ...
};
```

---

### Priority 1D: CORS Hardening (DAY 3)

**Current:** `Access-Control-Allow-Origin: *` (allows ANY website)

**Fix:**
```typescript
// supabase/functions/_shared/errorHandler.ts
const ALLOWED_ORIGINS = [
  'https://your-production-domain.com',
  'https://your-staging-domain.com',
  'http://localhost:8080', // Dev only
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';

  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (Deno.env.get('ENVIRONMENT') === 'development' && origin.startsWith('http://localhost'));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

// Update all edge functions to use getCorsHeaders(req) instead of corsHeaders
```

---

### Priority 1E: Secrets Management (DAY 4-5)

**Remove hardcoded secrets:**

1. **Google API Credentials** - Move to environment variables
```bash
# .env.production
VITE_GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-production-api-key

# Edge Functions secrets (set via Supabase CLI)
OPENAI_API_KEY=sk-...
```

2. **Update googleDrive.ts to validate credentials:**
```typescript
export async function loadGoogleAPI(): Promise<void> {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!apiKey || !clientId || apiKey === 'undefined' || clientId === 'undefined') {
    throw new Error(
      'Google Drive is not configured. Contact your administrator.'
    );
  }
  // ...
}
```

3. **Add secrets rotation strategy:**
   - Google OAuth: Rotate every 90 days
   - OpenAI API key: Rotate every 6 months
   - Supabase service role key: Rotate annually

---

## Phase 2: Critical Performance Optimizations (Days 6-10)

### Priority 2A: Database Indexes (DAY 6)

**Create comprehensive index migration:**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_composite_indexes.sql

-- Critical: Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_user_status
  ON public.cases(user_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_user
  ON public.documents(case_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_analyzed
  ON public.documents(case_id, ai_analyzed, created_at DESC)
  WHERE ai_analyzed = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_bates
  ON public.documents(case_id, bates_number)
  WHERE bates_number IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_case_media
  ON public.documents(case_id, media_type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_case_date
  ON public.timeline_events(case_id, event_date, importance);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_jobs_active
  ON public.import_jobs(case_id, status, updated_at DESC)
  WHERE status IN ('pending', 'processing');

-- Full-text search indexes
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_text_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(ocr_text, '') || ' ' || COALESCE(name, ''))) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_ocr_text_fts
  ON public.documents USING GIN (ocr_text_tsv);

-- Analyze tables for query planner
ANALYZE public.cases;
ANALYZE public.documents;
ANALYZE public.timeline_events;
ANALYZE public.import_jobs;
```

**Verify performance:**
```sql
-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE case_id = 'some-uuid' AND user_id = 'some-user-id'
ORDER BY created_at DESC
LIMIT 50;
-- Expected: Index Scan using idx_documents_case_user (cost <10, time <5ms)
```

---

### Priority 2B: Frontend Code Splitting (DAY 7)

**Implement lazy loading:**

```typescript
// src/App.tsx
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Public pages - eager load
import Landing from "./pages/Landing";
import Login from "./pages/Login";

// Authenticated pages - lazy load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const Research = lazy(() => import("./pages/Research"));
const Calendar = lazy(() => import("./pages/Calendar"));
const TrialPrep = lazy(() => import("./pages/TrialPrep"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Other protected routes */}

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Expected Results:**
- Initial bundle: 800KB → 250KB (69% reduction)
- Lighthouse score: 50 → 85+
- First Contentful Paint: 3s → 1s

---

### Priority 2C: React Query Optimization (DAY 8)

**Configure global defaults:**

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: "stale",
    },
    mutations: {
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      console.error("Query error:", error);
      // Optionally show toast notification
    },
  }),
});
```

**Fix N+1 queries in CaseDetail:**

```typescript
// src/pages/CaseDetail.tsx
const { data: caseDetailData, isLoading } = useQuery({
  queryKey: ["case_detail", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("cases")
      .select(`
        *,
        documents (*),
        timeline_events (*)
      `)
      .eq("id", id)
      .order("bates_number", { foreignTable: "documents", ascending: true, nullsFirst: false })
      .order("event_date", { foreignTable: "timeline_events", ascending: true })
      .single();

    if (error) throw error;

    return {
      case: data,
      documents: data.documents || [],
      timelineEvents: data.timeline_events || [],
    };
  },
  staleTime: 30000, // 30 seconds
});

const caseData = caseDetailData?.case;
const documents = caseDetailData?.documents ?? [];
const timelineEvents = caseDetailData?.timelineEvents ?? [];
```

---

### Priority 2D: Virtual Scrolling for Documents (DAY 9-10)

**Install dependency:**
```bash
npm install react-window
```

**Implement virtualized list:**

```typescript
// src/pages/CaseDetail.tsx
import { FixedSizeList as List } from 'react-window';
import { memo } from 'react';

const DocumentRow = memo(({ index, style, data }) => {
  const doc = data[index];

  return (
    <div style={style} className="px-3">
      <Card className="glass-card hover:shadow-md transition-shadow mb-3">
        {/* Existing document card content */}
      </Card>
    </div>
  );
});

// In render:
<List
  height={800}
  itemCount={documents.length}
  itemSize={150} // Approximate height of each card
  width="100%"
  itemData={documents}
>
  {DocumentRow}
</List>
```

---

## Phase 3: Production Infrastructure (Days 11-13)

### Environment Configuration

**Create environment-specific configs:**

```bash
# .env.development
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key
VITE_GOOGLE_CLIENT_ID=dev-client-id
VITE_GOOGLE_API_KEY=dev-api-key

# .env.staging
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=staging-anon-key
VITE_GOOGLE_CLIENT_ID=staging-client-id
VITE_GOOGLE_API_KEY=staging-api-key

# .env.production
VITE_SUPABASE_URL=https://czrqlvvjrwizwdyefldo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=prod-anon-key
VITE_GOOGLE_CLIENT_ID=prod-client-id
VITE_GOOGLE_API_KEY=prod-api-key
```

---

### CI/CD Pipeline

**GitHub Actions workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  deploy-migrations:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-functions:
    needs: deploy-migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: |
          supabase functions deploy import-google-drive
          supabase functions deploy ocr-document
          supabase functions deploy transcribe-media
          supabase functions deploy create-video-room
          supabase functions deploy join-video-room
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-frontend:
    needs: deploy-functions
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
      - run: echo "Deploy to your hosting provider or Vercel here"
```

---

### Monitoring & Observability

**1. Supabase Monitoring:**
- Enable Supabase Logs
- Set up alerts for:
  - Edge function errors (>5% error rate)
  - Database slow queries (>1s)
  - Storage usage (>80% capacity)
  - API rate limit warnings

**2. Frontend Monitoring:**

```typescript
// src/lib/analytics.ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1, // 10% of transactions
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});

export function trackEvent(name: string, properties?: Record<string, any>) {
  // Analytics tracking
  if (window.gtag) {
    window.gtag('event', name, properties);
  }
}
```

**3. Performance Monitoring:**

```typescript
// src/main.tsx
import { reportWebVitals } from './reportWebVitals';

reportWebVitals((metric) => {
  // Send to analytics
  console.log(metric);
});
```

---

## Phase 4: Testing & QA (Days 14-15)

### Security Testing Checklist

- [ ] Verify authenticated users cannot access other users' documents
- [ ] Test SQL injection attempts on all input fields
- [ ] Verify CORS restrictions work correctly
- [ ] Test rate limiting (attempt 6+ imports in 1 minute)
- [ ] Verify Google OAuth tokens are not logged
- [ ] Test edge function authorization bypasses
- [ ] Verify storage bucket is not publicly accessible
- [ ] Test XSS attempts in document names and notes

### Performance Testing

```bash
# Load testing with k6
npm install -g k6

k6 run --vus 50 --duration 30s performance-test.js
```

```javascript
// performance-test.js
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.get('https://your-app.com/cases');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

### User Acceptance Testing

- [ ] Import 100+ file folder from Google Drive
- [ ] Test OCR on PDF documents
- [ ] Test audio transcription
- [ ] Create and join video room
- [ ] Test timeline event creation
- [ ] Test document search and filtering
- [ ] Verify mobile responsiveness

---

## Deployment Checklist

### Pre-Deployment
- [ ] All migrations tested in staging
- [ ] Edge functions deployed to staging and tested
- [ ] Environment variables configured in production
- [ ] Backup current production database
- [ ] DNS records ready (if custom domain)
- [ ] SSL certificates configured

### Deployment Steps
1. [ ] Apply database migrations
2. [ ] Deploy edge functions
3. [ ] Deploy frontend build
4. [ ] Run smoke tests
5. [ ] Monitor for 24 hours

### Post-Deployment
- [ ] Verify all edge functions responding
- [ ] Check error rates in Supabase dashboard
- [ ] Test critical user flows
- [ ] Monitor performance metrics
- [ ] Notify users of any breaking changes

---

## Rollback Plan

If critical issues arise:

1. **Frontend rollback:** Revert to previous Vercel/your hosting provider deployment
2. **Edge functions:** Redeploy previous version via Supabase CLI
3. **Database:** Restore from pre-deployment backup

```bash
# Rollback migrations (use with caution)
supabase db reset --db-url postgresql://...
```

---

## Success Metrics

### Security
- **Zero** unauthorized access attempts succeed
- **Zero** exposed credentials in logs or responses
- **100%** of edge functions require authentication

### Performance
- Initial page load: **< 2 seconds**
- Case detail load: **< 500ms**
- Document query (1000 docs): **< 100ms**
- 1000-file import: **< 5 minutes**

### Reliability
- **99.9%** uptime
- **< 0.1%** error rate
- **Zero** data loss incidents

---

## Estimated Costs (Production)

**Monthly Costs:**
- Supabase Pro: **$25/month**
- Storage (100GB): **$10/month**
- Edge Functions (100K invocations): **$2/month**
- OpenAI API (Whisper transcription): **$20-50/month** (usage-based)
- Google Cloud (OCR via Gemini): **$10-30/month** (usage-based)
- Vercel/your hosting provider hosting: **$20-50/month**

**Total: $87-167/month** (scales with usage)

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data breach | Medium | Critical | Implement all Phase 1 security fixes |
| Service outage | Low | High | Multi-region Supabase, monitoring alerts |
| Performance degradation | Medium | Medium | Implement Phase 2 optimizations, load testing |
| Cost overrun | Medium | Low | Set up billing alerts, usage quotas |
| Migration failure | Low | High | Test in staging, maintain rollback procedure |

---

## Next Steps

1. **Immediate (This Week):**
   - Apply Priority 1A storage security fix
   - Deploy improved error handling (already committed)
   - Test in staging environment

2. **Week 2:**
   - Complete Phase 1 security fixes
   - Begin Phase 2 performance optimizations
   - Set up CI/CD pipeline

3. **Week 3:**
   - Finish performance optimizations
   - Complete testing and QA
   - Production deployment

---

**Document Version:** 1.0
**Last Updated:** 2025-12-28
**Next Review:** After Phase 1 completion

---

_This deployment plan was generated with assistance from Claude Code using multiple specialized AI agents for security audit, performance analysis, and architecture planning._
