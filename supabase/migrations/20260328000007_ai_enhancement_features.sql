-- AI Enhancement Features Migration
-- Adds tables and columns for: judicial profiles, privilege log, argument analysis,
-- witness prep enrichment, and cross-document intelligence storage.

-- ────────────────────────────────────────────────────
-- 1. Judicial Intelligence: Cache judge profiles
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.judicial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  judge_name TEXT NOT NULL,
  court TEXT NOT NULL DEFAULT 'Unknown',
  profile_data JSONB,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.judicial_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'judicial_profiles' AND policyname = 'Users manage own judicial profiles'
  ) THEN
    CREATE POLICY "Users manage own judicial profiles"
      ON public.judicial_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_judicial_profiles_judge_court
  ON public.judicial_profiles(judge_name, court);

-- ────────────────────────────────────────────────────
-- 2. Privilege Log Entries
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.privilege_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bates_number TEXT,
  date_of_document TEXT,
  author TEXT,
  recipients TEXT[] DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  privilege_type TEXT NOT NULL DEFAULT 'attorney_client',
  work_product_type TEXT,
  basis_for_privilege TEXT,
  confidence_score INTEGER,
  flags_for_review TEXT[] DEFAULT '{}',
  reviewed_by_attorney BOOLEAN DEFAULT false,
  final_determination TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.privilege_log_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'privilege_log_entries' AND policyname = 'Users manage own privilege log entries'
  ) THEN
    CREATE POLICY "Users manage own privilege log entries"
      ON public.privilege_log_entries
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_privilege_log_case_bates
  ON public.privilege_log_entries(case_id, bates_number)
  WHERE bates_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_privilege_log_case_id
  ON public.privilege_log_entries(case_id);

-- ────────────────────────────────────────────────────
-- 3. Argument Analysis Results (attached to legal_briefs)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.argument_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID REFERENCES public.legal_briefs(id) ON DELETE CASCADE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER,
  predicted_reception TEXT,
  judge_first_impression TEXT,
  argument_scores JSONB DEFAULT '[]',
  strongest_argument TEXT,
  weakest_argument TEXT,
  missing_elements TEXT[] DEFAULT '{}',
  citation_gaps TEXT[] DEFAULT '{}',
  procedural_issues TEXT[] DEFAULT '{}',
  overall_assessment TEXT,
  top_three_improvements TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.argument_analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'argument_analyses' AND policyname = 'Users manage own argument analyses'
  ) THEN
    CREATE POLICY "Users manage own argument analyses"
      ON public.argument_analyses
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_argument_analyses_brief_id
  ON public.argument_analyses(brief_id);

-- ────────────────────────────────────────────────────
-- 4. Enrich legal_briefs with AI generation tracking
-- ────────────────────────────────────────────────────
ALTER TABLE public.legal_briefs
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_draft_model TEXT;

-- ────────────────────────────────────────────────────
-- 5. Enrich deposition_outlines with witness prep fields
-- ────────────────────────────────────────────────────
ALTER TABLE public.deposition_outlines
  ADD COLUMN IF NOT EXISTS witness_role TEXT DEFAULT 'fact_witness',
  ADD COLUMN IF NOT EXISTS prep_status TEXT DEFAULT 'needed',
  ADD COLUMN IF NOT EXISTS impeachment_material JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS risk_assessment JSONB,
  ADD COLUMN IF NOT EXISTS key_exhibits JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS strategic_notes TEXT;

-- ────────────────────────────────────────────────────
-- 6. Add unique constraint to case_strategies for upsert
-- ────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'case_strategies' AND indexname = 'idx_case_strategies_case_type_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_case_strategies_case_type_unique
      ON public.case_strategies(case_id, analysis_type);
  END IF;
END $$;
