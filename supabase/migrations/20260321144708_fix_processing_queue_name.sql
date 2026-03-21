-- Create ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_type AS ENUM ('ocr', 'ai_analysis', 'transcription', 'text_extraction', 'email_parse');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  case_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID,
  processing_type processing_type NOT NULL,
  status processing_status DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  content_hash TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  
  -- Processing metadata
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  
  -- Results
  result JSONB,
  provider_used TEXT,
  processing_duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON public.processing_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_user ON public.processing_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_case ON public.processing_queue(case_id, status);

-- Function to claim next job from queue (atomic, prevents double-processing)
CREATE OR REPLACE FUNCTION claim_next_job(job_type processing_type DEFAULT NULL)
RETURNS SETOF processing_queue AS $$
  UPDATE processing_queue
  SET status = 'processing',
      attempts = attempts + 1,
      last_attempted_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM processing_queue
    WHERE status IN ('pending', 'retrying')
      AND next_retry_at <= now()
      AND attempts < max_attempts
      AND (job_type IS NULL OR processing_type = job_type)
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;

-- Function to complete a job
CREATE OR REPLACE FUNCTION complete_job(
  job_id UUID,
  job_result JSONB,
  provider TEXT,
  duration_ms INTEGER
) RETURNS void AS $$
  UPDATE processing_queue
  SET status = 'completed',
      result = job_result,
      provider_used = provider,
      processing_duration_ms = duration_ms,
      completed_at = now(),
      updated_at = now()
  WHERE id = job_id;
$$ LANGUAGE sql;

-- Function to fail a job with exponential backoff
CREATE OR REPLACE FUNCTION fail_job(
  job_id UUID,
  error_msg TEXT
) RETURNS void AS $$
  UPDATE processing_queue
  SET status = CASE 
        WHEN attempts >= max_attempts THEN 'failed'::processing_status
        ELSE 'retrying'::processing_status
      END,
      last_error = error_msg,
      next_retry_at = now() + (power(2, attempts) * interval '1 minute'),
      updated_at = now()
  WHERE id = job_id;
$$ LANGUAGE sql;
