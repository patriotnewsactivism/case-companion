-- Create OCR queue table for processing documents
-- This table tracks OCR jobs with rate limit handling and retry logic

CREATE TABLE IF NOT EXISTS public.ocr_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_after TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ocr_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own OCR jobs" ON public.ocr_queue;
CREATE POLICY "Users can view their own OCR jobs"
  ON public.ocr_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own OCR jobs" ON public.ocr_queue;
CREATE POLICY "Users can insert their own OCR jobs"
  ON public.ocr_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own OCR jobs" ON public.ocr_queue;
CREATE POLICY "Users can update their own OCR jobs"
  ON public.ocr_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for queue processor)
DROP POLICY IF EXISTS "Service role has full access" ON public.ocr_queue;
CREATE POLICY "Service role has full access"
  ON public.ocr_queue FOR ALL
  USING (true);

-- Create indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON public.ocr_queue(status);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_priority_created ON public.ocr_queue(priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ocr_queue_retry ON public.ocr_queue(retry_after) WHERE status = 'pending' AND retry_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_queue_document ON public.ocr_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_case ON public.ocr_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_user ON public.ocr_queue(user_id);

-- Create unique constraint to prevent duplicate pending jobs for same document
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocr_queue_unique_pending 
  ON public.ocr_queue(document_id) 
  WHERE status IN ('pending', 'processing');

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_ocr_queue_updated_at ON public.ocr_queue;
CREATE TRIGGER update_ocr_queue_updated_at
  BEFORE UPDATE ON public.ocr_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
