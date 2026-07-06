-- ═══════════════════════════════════════════════════════════════
-- Outbound Requests Module
-- Tracks requests the firm SENDS OUT: public-records/FOIA requests,
-- discovery demands served on the opposing party, preservation /
-- litigation-hold letters, and third-party subpoenas.
-- (Distinct from discovery_requests, which tracks INCOMING discovery
--  the firm responds to.)
-- Fully idempotent so it re-applies cleanly on Supabase preview branches.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.outbound_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_category TEXT NOT NULL DEFAULT 'public_records',
  request_subtype TEXT,
  jurisdiction TEXT,
  statute_reference TEXT,
  title TEXT,
  recipient_name TEXT,
  recipient_agency TEXT,
  recipient_email TEXT,
  recipient_address TEXT,
  records_sought TEXT,
  generated_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_date DATE,
  response_due_date DATE,
  response_date DATE,
  fee_amount NUMERIC,
  fee_waiver_requested BOOLEAN DEFAULT false,
  tracking_number TEXT,
  notes TEXT,
  -- Provenance for cross-app sync (case-companion | casebuddy-ai-law-partner | casebuddy-discoverylens)
  source_app TEXT DEFAULT 'case-companion',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Guarded CHECK constraints (idempotent: only add if not present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'outbound_requests'
      AND c.conname = 'outbound_requests_category_check'
  ) THEN
    ALTER TABLE public.outbound_requests
      ADD CONSTRAINT outbound_requests_category_check
      CHECK (request_category IN ('public_records', 'discovery_demand', 'preservation_letter', 'subpoena'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'outbound_requests'
      AND c.conname = 'outbound_requests_status_check'
  ) THEN
    ALTER TABLE public.outbound_requests
      ADD CONSTRAINT outbound_requests_status_check
      CHECK (status IN ('draft', 'sent', 'acknowledged', 'partial', 'fulfilled', 'denied', 'appealed', 'overdue'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outbound_requests_case_id ON public.outbound_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_user_id ON public.outbound_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_status ON public.outbound_requests(status);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_response_due_date ON public.outbound_requests(response_due_date);
CREATE INDEX IF NOT EXISTS idx_outbound_requests_category ON public.outbound_requests(request_category);

-- Row Level Security: users only access their own rows
ALTER TABLE public.outbound_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own outbound requests"
    ON public.outbound_requests FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object OR sqlstate '42703' THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own outbound requests"
    ON public.outbound_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object OR sqlstate '42703' THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own outbound requests"
    ON public.outbound_requests FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object OR sqlstate '42703' THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own outbound requests"
    ON public.outbound_requests FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object OR sqlstate '42703' THEN NULL;
END $$;

-- updated_at trigger (reuses the shared function)
DO $$ BEGIN
  CREATE TRIGGER update_outbound_requests_updated_at
    BEFORE UPDATE ON public.outbound_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object OR sqlstate '42703' THEN NULL;
END $$;

-- ─── Smart timeline integration ────────────────────────────────
-- Let request lifecycle events (sent / response-due / responded) live on the
-- case timeline so the unified smart timeline reflects outbound activity.
-- source_request_id lets us re-sync those events idempotently.
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES public.outbound_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_timeline_events_source_request_id
  ON public.timeline_events(source_request_id);

-- ─── Cross-app sync provenance ─────────────────────────────────
-- The CaseBuddy suite (case-companion, casebuddy-ai-law-partner,
-- casebuddy-discoverylens) shares this Supabase project. Tag shared entities
-- with the app that created/synced them so each app can display provenance
-- and filter its own vs. imported records. See docs/INTEGRATION.md.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_app TEXT;
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS source_app TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_source_app ON public.documents(source_app);

NOTIFY pgrst, 'reload schema';
