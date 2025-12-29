-- Safe migration: Only add import_jobs and missing columns if they don't exist
-- This migration is idempotent and safe to run multiple times

-- Create import_jobs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'import_jobs') THEN
    CREATE TABLE public.import_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

      -- Source information
      source_type TEXT NOT NULL DEFAULT 'google_drive',
      source_folder_id TEXT,
      source_folder_name TEXT,
      source_folder_path TEXT,

      -- Progress tracking
      status TEXT NOT NULL DEFAULT 'pending',
      total_files INTEGER DEFAULT 0,
      processed_files INTEGER DEFAULT 0,
      successful_files INTEGER DEFAULT 0,
      failed_files INTEGER DEFAULT 0,

      -- Error tracking
      error_message TEXT,
      failed_file_details JSONB DEFAULT '[]'::jsonb,

      -- Metadata
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX idx_import_jobs_case_id ON public.import_jobs(case_id);
    CREATE INDEX idx_import_jobs_user_id ON public.import_jobs(user_id);
    CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

    -- Enable RLS
    ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

    -- RLS Policies
    CREATE POLICY "Users can view their own import jobs"
      ON public.import_jobs
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own import jobs"
      ON public.import_jobs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own import jobs"
      ON public.import_jobs
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);

    -- Add updated_at trigger function if not exists
    CREATE OR REPLACE FUNCTION update_import_jobs_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Add trigger
    CREATE TRIGGER update_import_jobs_updated_at_trigger
      BEFORE UPDATE ON public.import_jobs
      FOR EACH ROW
      EXECUTE FUNCTION update_import_jobs_updated_at();

    RAISE NOTICE 'Created import_jobs table successfully';
  ELSE
    RAISE NOTICE 'import_jobs table already exists, skipping creation';
  END IF;
END $$;

-- Add media_type column to documents if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.documents
    ADD COLUMN media_type TEXT DEFAULT 'document';

    RAISE NOTICE 'Added media_type column to documents';
  ELSE
    RAISE NOTICE 'media_type column already exists in documents';
  END IF;
END $$;

-- Add import_job_id column to documents if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'import_job_id'
  ) THEN
    ALTER TABLE public.documents
    ADD COLUMN import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL;

    CREATE INDEX idx_documents_import_job_id ON public.documents(import_job_id);

    RAISE NOTICE 'Added import_job_id column to documents';
  ELSE
    RAISE NOTICE 'import_job_id column already exists in documents';
  END IF;
END $$;

-- Add Google Drive metadata fields to documents if they don't exist
DO $$
BEGIN
  -- drive_file_id
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'drive_file_id'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN drive_file_id TEXT;
    CREATE INDEX idx_documents_drive_file_id ON public.documents(drive_file_id);
    RAISE NOTICE 'Added drive_file_id column';
  END IF;

  -- drive_file_path
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'drive_file_path'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN drive_file_path TEXT;
    RAISE NOTICE 'Added drive_file_path column';
  END IF;

  -- transcription_text
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'transcription_text'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN transcription_text TEXT;
    RAISE NOTICE 'Added transcription_text column';
  END IF;

  -- transcription_processed_at
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'transcription_processed_at'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN transcription_processed_at TIMESTAMPTZ;
    RAISE NOTICE 'Added transcription_processed_at column';
  END IF;

  -- duration_seconds
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'documents'
    AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN duration_seconds INTEGER;
    RAISE NOTICE 'Added duration_seconds column';
  END IF;
END $$;

-- Add media_type index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'documents'
    AND indexname = 'idx_documents_media_type'
  ) THEN
    CREATE INDEX idx_documents_media_type ON public.documents(media_type);
    RAISE NOTICE 'Added media_type index';
  END IF;
END $$;

-- Verify the import_jobs table was created successfully
DO $$
DECLARE
  table_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'import_jobs'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE '✓ Migration completed successfully - import_jobs table is ready';
  ELSE
    RAISE EXCEPTION '✗ Migration failed - import_jobs table was not created';
  END IF;
END $$;
