-- Migration: Conflict Checking
-- Adds opposing-party columns to cases, creates a conflict_checks log,
-- enables pg_trgm for fuzzy matching, builds trigram + full-text indexes,
-- and provides a check_conflicts() function.

-- =====================================================================
-- 1. Add conflict-related columns to cases
-- =====================================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS opposing_party TEXT,
  ADD COLUMN IF NOT EXISTS opposing_counsel TEXT,
  ADD COLUMN IF NOT EXISTS court_name TEXT,
  ADD COLUMN IF NOT EXISTS case_number TEXT,
  ADD COLUMN IF NOT EXISTS related_parties JSONB DEFAULT '[]'::jsonb;

-- =====================================================================
-- 2. Create conflict_checks table
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.conflict_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  search_terms JSONB NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  conflicts_found INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'clear' CHECK (status IN ('clear', 'conflict', 'potential', 'waived')),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conflict_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can view their own conflict checks"
  ON public.conflict_checks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can insert their own conflict checks"
  ON public.conflict_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can update their own conflict checks"
  ON public.conflict_checks FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================================
-- 3. Enable pg_trgm extension for fuzzy similarity matching
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- 4. GIN trigram indexes for fuzzy searches on cases
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_cases_client_name_trgm
  ON public.cases USING gin (client_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cases_opposing_party_trgm
  ON public.cases USING gin (opposing_party gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cases_opposing_counsel_trgm
  ON public.cases USING gin (opposing_counsel gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cases_name_trgm
  ON public.cases USING gin (name gin_trgm_ops);

-- =====================================================================
-- 5. Generated tsvector column for full-text search on cases
-- =====================================================================

-- Add the generated column (skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE public.cases
      ADD COLUMN search_vector tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english',
          coalesce(name, '') || ' ' ||
          coalesce(client_name, '') || ' ' ||
          coalesce(opposing_party, '') || ' ' ||
          coalesce(opposing_counsel, '') || ' ' ||
          coalesce(court_name, '') || ' ' ||
          coalesce(case_number, '') || ' ' ||
          coalesce(notes, '')
        )
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_search_vector
  ON public.cases USING gin (search_vector);

-- =====================================================================
-- 6. check_conflicts() function
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_conflicts(
  search_client_name TEXT,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  case_id UUID,
  case_name TEXT,
  client_name TEXT,
  opposing_party TEXT,
  match_type TEXT,
  match_field TEXT,
  similarity_score FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY

  -- Match against client_name
  SELECT
    c.id            AS case_id,
    c.name          AS case_name,
    c.client_name   AS client_name,
    c.opposing_party AS opposing_party,
    'client'::TEXT  AS match_type,
    'client_name'::TEXT AS match_field,
    similarity(c.client_name, search_client_name)::FLOAT AS similarity_score
  FROM public.cases c
  WHERE similarity(c.client_name, search_client_name) >= similarity_threshold

  UNION ALL

  -- Match against opposing_party
  SELECT
    c.id            AS case_id,
    c.name          AS case_name,
    c.client_name   AS client_name,
    c.opposing_party AS opposing_party,
    'opposing'::TEXT AS match_type,
    'opposing_party'::TEXT AS match_field,
    similarity(c.opposing_party, search_client_name)::FLOAT AS similarity_score
  FROM public.cases c
  WHERE c.opposing_party IS NOT NULL
    AND similarity(c.opposing_party, search_client_name) >= similarity_threshold

  UNION ALL

  -- Match where the new client name appears as an existing opposing_party
  -- (i.e. we previously sued this person and now they want to hire us)
  SELECT
    c.id            AS case_id,
    c.name          AS case_name,
    c.client_name   AS client_name,
    c.opposing_party AS opposing_party,
    'cross_conflict'::TEXT AS match_type,
    'opposing_party'::TEXT AS match_field,
    similarity(c.opposing_party, search_client_name)::FLOAT AS similarity_score
  FROM public.cases c
  WHERE c.opposing_party IS NOT NULL
    AND similarity(c.opposing_party, search_client_name) >= (similarity_threshold + 0.1)
    AND c.user_id = auth.uid()

  ORDER BY similarity_score DESC;
END;
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
