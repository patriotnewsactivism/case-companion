-- Create table to track Google Drive import jobs
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source information
  source_type TEXT NOT NULL DEFAULT 'google_drive', -- 'google_drive', 'dropbox', etc.
  source_folder_id TEXT, -- Google Drive folder ID
  source_folder_name TEXT,
  source_folder_path TEXT, -- Full path in Drive

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  failed_file_details JSONB DEFAULT '[]'::jsonb, -- Array of {filename, error} objects

  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_case_id ON public.import_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can create their own import jobs"
  ON public.import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_import_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_import_jobs_updated_at_trigger ON public.import_jobs;
CREATE TRIGGER update_import_jobs_updated_at_trigger
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_import_jobs_updated_at();

-- Add media_type field to documents table to distinguish between document/audio/video
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'document'; -- 'document', 'audio', 'video', 'image'

-- Add import job reference to documents
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL;

-- Add Google Drive metadata fields
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
ADD COLUMN IF NOT EXISTS drive_file_path TEXT,
ADD COLUMN IF NOT EXISTS transcription_text TEXT, -- For audio/video transcriptions
ADD COLUMN IF NOT EXISTS transcription_processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER; -- For audio/video duration

-- Create index for drive file lookups
CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id ON public.documents(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_documents_import_job_id ON public.documents(import_job_id);
CREATE INDEX IF NOT EXISTS idx_documents_media_type ON public.documents(media_type);
