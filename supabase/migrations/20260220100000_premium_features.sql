-- Premium Features Migration for CaseBuddy
-- Adds 8 new tables for premium features: trial practice, mock jury, settlement analysis, discovery, evidence analysis, deposition outlines, case law research, and performance summaries

-- =================================================================
-- STEP 1: Create premium feature tables
-- =================================================================

-- 1. Trial Sessions - For recording and replaying trial practice sessions
CREATE TABLE IF NOT EXISTS public.trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phase TEXT NOT NULL,
  mode TEXT NOT NULL,
  duration_seconds INTEGER,
  transcript JSONB DEFAULT '[]'::jsonb,
  audio_url TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  metrics JSONB DEFAULT '{}'::jsonb,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Mock Jury Sessions - For AI jury simulation
CREATE TABLE IF NOT EXISTS public.mock_jury_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opening_statement TEXT,
  closing_argument TEXT,
  jurors JSONB DEFAULT '[]'::jsonb,
  deliberation JSONB DEFAULT '[]'::jsonb,
  verdict TEXT CHECK (verdict IN ('guilty', 'not_guilty', 'hung')),
  confidence_score INTEGER,
  vote_tally JSONB DEFAULT '{"guilty": 0, "notGuilty": 0}'::jsonb,
  reasoning TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Settlement Analyses - For case valuation
CREATE TABLE IF NOT EXISTS public.settlement_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medical_expenses DECIMAL(12,2) DEFAULT 0,
  medical_expenses_future DECIMAL(12,2) DEFAULT 0,
  lost_wages DECIMAL(12,2) DEFAULT 0,
  lost_wages_future DECIMAL(12,2) DEFAULT 0,
  property_damage DECIMAL(12,2) DEFAULT 0,
  other_economic DECIMAL(12,2) DEFAULT 0,
  pain_suffering DECIMAL(12,2) DEFAULT 0,
  emotional_distress DECIMAL(12,2) DEFAULT 0,
  loss_of_consortium DECIMAL(12,2) DEFAULT 0,
  punitive_multiplier DECIMAL(3,2) DEFAULT 0,
  comparative_negligence INTEGER DEFAULT 0 CHECK (comparative_negligence >= 0 AND comparative_negligence <= 100),
  settlement_range_low DECIMAL(12,2) DEFAULT 0,
  settlement_range_high DECIMAL(12,2) DEFAULT 0,
  recommended_demand DECIMAL(12,2) DEFAULT 0,
  factors JSONB DEFAULT '[]'::jsonb,
  negotiation_strategy TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Discovery Requests - For tracking discovery
CREATE TABLE IF NOT EXISTS public.discovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('interrogatory', 'request_for_production', 'request_for_admission', 'deposition')),
  request_number TEXT,
  question TEXT NOT NULL,
  response TEXT,
  objections TEXT[],
  served_date DATE,
  response_due_date DATE,
  response_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'objected', 'overdue')),
  privilege_log_entry BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Evidence Analyses - For evidence admissibility checking
CREATE TABLE IF NOT EXISTS public.evidence_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  evidence_description TEXT NOT NULL,
  overall_admissibility TEXT NOT NULL CHECK (overall_admissibility IN ('admissible', 'conditional', 'inadmissible')),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  issues JSONB DEFAULT '[]'::jsonb,
  suggested_foundations TEXT[],
  case_law_support JSONB DEFAULT '[]'::jsonb,
  motion_draft TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Deposition Outlines - For deposition preparation
CREATE TABLE IF NOT EXISTS public.deposition_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deponent_name TEXT NOT NULL,
  deponent_role TEXT,
  scheduled_date DATE,
  topics JSONB DEFAULT '[]'::jsonb,
  exhibit_list TEXT[],
  anticipated_objections JSONB DEFAULT '[]'::jsonb,
  key_documents TEXT[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Case Law Research - For saving research results
CREATE TABLE IF NOT EXISTS public.case_law_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Performance Summaries - For aggregated analytics
CREATE TABLE IF NOT EXISTS public.performance_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_sessions INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  improvement_rate DECIMAL(5,2) DEFAULT 0,
  strengths TEXT[],
  weaknesses TEXT[],
  top_filler_words JSONB DEFAULT '{}'::jsonb,
  recent_trend JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =================================================================
-- STEP 2: Enable Row Level Security
-- =================================================================

ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_jury_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposition_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_law_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_summaries ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- STEP 3: Create RLS Policies
-- =================================================================

-- Trial Sessions policies
DROP POLICY IF EXISTS "Users can view their own trial sessions" ON public.trial_sessions;
CREATE POLICY "Users can view their own trial sessions"
  ON public.trial_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own trial sessions" ON public.trial_sessions;
CREATE POLICY "Users can insert their own trial sessions"
  ON public.trial_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own trial sessions" ON public.trial_sessions;
CREATE POLICY "Users can update their own trial sessions"
  ON public.trial_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own trial sessions" ON public.trial_sessions;
CREATE POLICY "Users can delete their own trial sessions"
  ON public.trial_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Mock Jury Sessions policies
DROP POLICY IF EXISTS "Users can view their own mock jury sessions" ON public.mock_jury_sessions;
CREATE POLICY "Users can view their own mock jury sessions"
  ON public.mock_jury_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own mock jury sessions" ON public.mock_jury_sessions;
CREATE POLICY "Users can insert their own mock jury sessions"
  ON public.mock_jury_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mock jury sessions" ON public.mock_jury_sessions;
CREATE POLICY "Users can update their own mock jury sessions"
  ON public.mock_jury_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own mock jury sessions" ON public.mock_jury_sessions;
CREATE POLICY "Users can delete their own mock jury sessions"
  ON public.mock_jury_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Settlement Analyses policies
DROP POLICY IF EXISTS "Users can view their own settlement analyses" ON public.settlement_analyses;
CREATE POLICY "Users can view their own settlement analyses"
  ON public.settlement_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settlement analyses" ON public.settlement_analyses;
CREATE POLICY "Users can insert their own settlement analyses"
  ON public.settlement_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settlement analyses" ON public.settlement_analyses;
CREATE POLICY "Users can update their own settlement analyses"
  ON public.settlement_analyses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settlement analyses" ON public.settlement_analyses;
CREATE POLICY "Users can delete their own settlement analyses"
  ON public.settlement_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Discovery Requests policies
DROP POLICY IF EXISTS "Users can view their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can view their own discovery requests"
  ON public.discovery_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can insert their own discovery requests"
  ON public.discovery_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can update their own discovery requests"
  ON public.discovery_requests FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own discovery requests" ON public.discovery_requests;
CREATE POLICY "Users can delete their own discovery requests"
  ON public.discovery_requests FOR DELETE
  USING (auth.uid() = user_id);

-- Evidence Analyses policies
DROP POLICY IF EXISTS "Users can view their own evidence analyses" ON public.evidence_analyses;
CREATE POLICY "Users can view their own evidence analyses"
  ON public.evidence_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own evidence analyses" ON public.evidence_analyses;
CREATE POLICY "Users can insert their own evidence analyses"
  ON public.evidence_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own evidence analyses" ON public.evidence_analyses;
CREATE POLICY "Users can update their own evidence analyses"
  ON public.evidence_analyses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own evidence analyses" ON public.evidence_analyses;
CREATE POLICY "Users can delete their own evidence analyses"
  ON public.evidence_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Deposition Outlines policies
DROP POLICY IF EXISTS "Users can view their own deposition outlines" ON public.deposition_outlines;
CREATE POLICY "Users can view their own deposition outlines"
  ON public.deposition_outlines FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own deposition outlines" ON public.deposition_outlines;
CREATE POLICY "Users can insert their own deposition outlines"
  ON public.deposition_outlines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own deposition outlines" ON public.deposition_outlines;
CREATE POLICY "Users can update their own deposition outlines"
  ON public.deposition_outlines FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own deposition outlines" ON public.deposition_outlines;
CREATE POLICY "Users can delete their own deposition outlines"
  ON public.deposition_outlines FOR DELETE
  USING (auth.uid() = user_id);

-- Case Law Research policies
DROP POLICY IF EXISTS "Users can view their own case law research" ON public.case_law_research;
CREATE POLICY "Users can view their own case law research"
  ON public.case_law_research FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own case law research" ON public.case_law_research;
CREATE POLICY "Users can insert their own case law research"
  ON public.case_law_research FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own case law research" ON public.case_law_research;
CREATE POLICY "Users can update their own case law research"
  ON public.case_law_research FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own case law research" ON public.case_law_research;
CREATE POLICY "Users can delete their own case law research"
  ON public.case_law_research FOR DELETE
  USING (auth.uid() = user_id);

-- Performance Summaries policies
DROP POLICY IF EXISTS "Users can view their own performance summary" ON public.performance_summaries;
CREATE POLICY "Users can view their own performance summary"
  ON public.performance_summaries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own performance summary" ON public.performance_summaries;
CREATE POLICY "Users can insert their own performance summary"
  ON public.performance_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own performance summary" ON public.performance_summaries;
CREATE POLICY "Users can update their own performance summary"
  ON public.performance_summaries FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own performance summary" ON public.performance_summaries;
CREATE POLICY "Users can delete their own performance summary"
  ON public.performance_summaries FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- STEP 4: Create updated_at triggers
-- =================================================================

DROP TRIGGER IF EXISTS update_settlement_analyses_updated_at ON public.settlement_analyses;
CREATE TRIGGER update_settlement_analyses_updated_at
  BEFORE UPDATE ON public.settlement_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_discovery_requests_updated_at ON public.discovery_requests;
CREATE TRIGGER update_discovery_requests_updated_at
  BEFORE UPDATE ON public.discovery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_deposition_outlines_updated_at ON public.deposition_outlines;
CREATE TRIGGER update_deposition_outlines_updated_at
  BEFORE UPDATE ON public.deposition_outlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_summaries_updated_at ON public.performance_summaries;
CREATE TRIGGER update_performance_summaries_updated_at
  BEFORE UPDATE ON public.performance_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =================================================================
-- STEP 5: Create indexes for performance
-- =================================================================

-- Trial Sessions indexes
CREATE INDEX IF NOT EXISTS idx_trial_sessions_user_id ON public.trial_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_case_id ON public.trial_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_created_at ON public.trial_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_phase ON public.trial_sessions(phase);
CREATE INDEX IF NOT EXISTS idx_trial_sessions_mode ON public.trial_sessions(mode);

-- Mock Jury Sessions indexes
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_user_id ON public.mock_jury_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_case_id ON public.mock_jury_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_created_at ON public.mock_jury_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_jury_sessions_verdict ON public.mock_jury_sessions(verdict);

-- Settlement Analyses indexes
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_user_id ON public.settlement_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_case_id ON public.settlement_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_settlement_analyses_created_at ON public.settlement_analyses(created_at DESC);

-- Discovery Requests indexes
CREATE INDEX IF NOT EXISTS idx_discovery_requests_user_id ON public.discovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_case_id ON public.discovery_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_status ON public.discovery_requests(status);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_request_type ON public.discovery_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_response_due_date ON public.discovery_requests(response_due_date);
CREATE INDEX IF NOT EXISTS idx_discovery_requests_created_at ON public.discovery_requests(created_at DESC);

-- Evidence Analyses indexes
CREATE INDEX IF NOT EXISTS idx_evidence_analyses_user_id ON public.evidence_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_analyses_case_id ON public.evidence_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_analyses_document_id ON public.evidence_analyses(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_analyses_admissibility ON public.evidence_analyses(overall_admissibility);
CREATE INDEX IF NOT EXISTS idx_evidence_analyses_created_at ON public.evidence_analyses(created_at DESC);

-- Deposition Outlines indexes
CREATE INDEX IF NOT EXISTS idx_deposition_outlines_user_id ON public.deposition_outlines(user_id);
CREATE INDEX IF NOT EXISTS idx_deposition_outlines_case_id ON public.deposition_outlines(case_id);
CREATE INDEX IF NOT EXISTS idx_deposition_outlines_scheduled_date ON public.deposition_outlines(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deposition_outlines_created_at ON public.deposition_outlines(created_at DESC);

-- Case Law Research indexes
CREATE INDEX IF NOT EXISTS idx_case_law_research_user_id ON public.case_law_research(user_id);
CREATE INDEX IF NOT EXISTS idx_case_law_research_case_id ON public.case_law_research(case_id);
CREATE INDEX IF NOT EXISTS idx_case_law_research_created_at ON public.case_law_research(created_at DESC);

-- Performance Summaries indexes
CREATE INDEX IF NOT EXISTS idx_performance_summaries_user_id ON public.performance_summaries(user_id);

-- =================================================================
-- STEP 6: Refresh schema cache
-- =================================================================

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- =================================================================
-- Migration Complete!
-- =================================================================
