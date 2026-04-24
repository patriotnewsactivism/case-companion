-- Create processing_queue table (referenced by QueueManager and ProcessingStatusBar)
CREATE TABLE IF NOT EXISTS public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  payload JSONB,
  result JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own queue jobs" ON public.processing_queue;
CREATE POLICY "Users can view their own queue jobs"
  ON public.processing_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own queue jobs" ON public.processing_queue;
CREATE POLICY "Users can insert their own queue jobs"
  ON public.processing_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own queue jobs" ON public.processing_queue;
CREATE POLICY "Users can update their own queue jobs"
  ON public.processing_queue FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own queue jobs" ON public.processing_queue;
CREATE POLICY "Users can delete their own queue jobs"
  ON public.processing_queue FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_processing_queue_case_id ON public.processing_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON public.processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON public.processing_queue(status);
