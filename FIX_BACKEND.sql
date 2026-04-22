-- =================================================================
-- CASE COMPANION - COMPREHENSIVE DATABASE REPAIR SCRIPT
-- =================================================================
-- This script recreates all missing premium feature tables and ensures RLS is active.
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jpzkumgndqsdwimbvjku/editor

-- Ensure we have the helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Billable Hours / Time Entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  billable BOOLEAN DEFAULT true,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'unbilled' CHECK (status IN ('unbilled', 'billed', 'paid', 'written_off')),
  invoice_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Court Dates / Calendar Events
CREATE TABLE IF NOT EXISTS public.court_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('hearing', 'trial', 'motion', 'deposition', 'filing_deadline', 'discovery_deadline', 'mediation', 'conference', 'other')),
  location TEXT,
  courtroom TEXT,
  judge_name TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  reminder_days INTEGER DEFAULT 7,
  reminder_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'continued')),
  outcome TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Depositions (Historical/Tracking)
CREATE TABLE IF NOT EXISTS public.depositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deponent_name TEXT NOT NULL,
  deponent_type TEXT CHECK (deponent_type IN ('party', 'witness', 'expert', 'corporate_representative', 'other')),
  deponent_contact TEXT,
  deponent_email TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_estimate_hours DECIMAL(4,2),
  location TEXT,
  location_type TEXT CHECK (location_type IN ('in_person', 'video', 'telephonic')),
  court_reporter TEXT,
  videographer TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed')),
  transcript_url TEXT,
  video_url TEXT,
  summary TEXT,
  key_testimony TEXT[],
  objections_notes TEXT,
  follow_up_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Research Notes
CREATE TABLE IF NOT EXISTS public.research_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  research_topic TEXT,
  jurisdiction TEXT,
  case_citations TEXT[],
  statute_references TEXT[],
  content TEXT NOT NULL,
  ai_summary TEXT,
  key_findings TEXT[],
  applicable_to_case BOOLEAN DEFAULT false,
  source_urls TEXT[],
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Evidence Analyses
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

-- 6. Deposition Outlines (Planning)
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

-- 7. Case Law Research
CREATE TABLE IF NOT EXISTS public.case_law_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  results JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Performance Summaries
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

-- 9. Processing Queue
CREATE TABLE IF NOT EXISTS public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  case_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processing_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Trial Sessions
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

-- 11. Mock Jury Sessions
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

-- 12. Settlement Analyses
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

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposition_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_law_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_jury_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own time entries" ON public.time_entries;
CREATE POLICY "Users can view their own time entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own time entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own time entries" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own court dates" ON public.court_dates;
CREATE POLICY "Users can view their own court dates" ON public.court_dates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own court dates" ON public.court_dates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own court dates" ON public.court_dates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own court dates" ON public.court_dates FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own depositions" ON public.depositions;
CREATE POLICY "Users can view their own depositions" ON public.depositions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own depositions" ON public.depositions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own depositions" ON public.depositions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own depositions" ON public.depositions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own research notes" ON public.research_notes;
CREATE POLICY "Users can view their own research notes" ON public.research_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own research notes" ON public.research_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own research notes" ON public.research_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own research notes" ON public.research_notes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own evidence analyses" ON public.evidence_analyses;
CREATE POLICY "Users can view their own evidence analyses" ON public.evidence_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own evidence analyses" ON public.evidence_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own deposition outlines" ON public.deposition_outlines;
CREATE POLICY "Users can view their own deposition outlines" ON public.deposition_outlines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deposition outlines" ON public.deposition_outlines FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own case law research" ON public.case_law_research;
CREATE POLICY "Users can view their own case law research" ON public.case_law_research FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own case law research" ON public.case_law_research FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own performance summary" ON public.performance_summaries;
CREATE POLICY "Users can view their own performance summary" ON public.performance_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own performance summary" ON public.performance_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own processing queue" ON public.processing_queue;
CREATE POLICY "Users can view their own processing queue" ON public.processing_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own processing queue" ON public.processing_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own trial sessions" ON public.trial_sessions;
CREATE POLICY "Users can view their own trial sessions" ON public.trial_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own trial sessions" ON public.trial_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own mock jury sessions" ON public.mock_jury_sessions;
CREATE POLICY "Users can view their own mock jury sessions" ON public.mock_jury_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mock jury sessions" ON public.mock_jury_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own settlement analyses" ON public.settlement_analyses;
CREATE POLICY "Users can view their own settlement analyses" ON public.settlement_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settlement analyses" ON public.settlement_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers
DROP TRIGGER IF EXISTS update_time_entries_updated_at ON public.time_entries;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_court_dates_updated_at ON public.court_dates;
CREATE TRIGGER update_court_dates_updated_at BEFORE UPDATE ON public.court_dates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_depositions_updated_at ON public.depositions;
CREATE TRIGGER update_depositions_updated_at BEFORE UPDATE ON public.depositions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_research_notes_updated_at ON public.research_notes;
CREATE TRIGGER update_research_notes_updated_at BEFORE UPDATE ON public.research_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_deposition_outlines_updated_at ON public.deposition_outlines;
CREATE TRIGGER update_deposition_outlines_updated_at BEFORE UPDATE ON public.deposition_outlines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_performance_summaries_updated_at ON public.performance_summaries;
CREATE TRIGGER update_performance_summaries_updated_at BEFORE UPDATE ON public.performance_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_processing_queue_updated_at ON public.processing_queue;
CREATE TRIGGER update_processing_queue_updated_at BEFORE UPDATE ON public.processing_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_settlement_analyses_updated_at ON public.settlement_analyses;
CREATE TRIGGER update_settlement_analyses_updated_at BEFORE UPDATE ON public.settlement_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC for SQL Execution (Restricted to service_role)
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security check: only allow if the caller is service_role
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Only service_role can execute arbitrary SQL';
  END IF;

  EXECUTE sql;
  RETURN '{"status": "success"}'::jsonb;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
