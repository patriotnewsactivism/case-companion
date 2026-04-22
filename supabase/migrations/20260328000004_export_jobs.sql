-- Migration: Export Jobs
-- Tracks asynchronous document/case export operations (PDF briefs,
-- CSV billing, DOCX filings, etc.).

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN (
    'pdf_brief', 'csv_billing', 'docx_filing', 'pdf_case_summary', 'csv_documents'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  options JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_created
  ON public.export_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_export_jobs_case_id
  ON public.export_jobs (case_id);

-- Enable RLS
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage only their own export jobs
DROP POLICY IF EXISTS "Users can view their own export jobs" ON public.export_jobs;
CREATE POLICY "Users can view their own export jobs"
  ON public.export_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own export jobs" ON public.export_jobs;
CREATE POLICY "Users can insert their own export jobs"
  ON public.export_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own export jobs" ON public.export_jobs;
CREATE POLICY "Users can update their own export jobs"
  ON public.export_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
