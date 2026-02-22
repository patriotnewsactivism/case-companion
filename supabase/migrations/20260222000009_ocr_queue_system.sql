-- OCR Queue System Migration
-- Manages document OCR processing with priority queue

-- Create OCR status enum
DO $$ BEGIN
  CREATE TYPE public.ocr_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create OCR provider enum
DO $$ BEGIN
  CREATE TYPE public.ocr_provider AS ENUM ('azure', 'ocr_space', 'gemini');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create OCR queue table
CREATE TABLE IF NOT EXISTS public.ocr_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.ocr_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  provider public.ocr_provider,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  retry_after TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ocr_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own OCR queue items" ON public.ocr_queue;
CREATE POLICY "Users can view their own OCR queue items"
  ON public.ocr_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own OCR queue items" ON public.ocr_queue;
CREATE POLICY "Users can insert their own OCR queue items"
  ON public.ocr_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own OCR queue items" ON public.ocr_queue;
CREATE POLICY "Users can update their own OCR queue items"
  ON public.ocr_queue FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own OCR queue items" ON public.ocr_queue;
CREATE POLICY "Users can delete their own OCR queue items"
  ON public.ocr_queue FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status_priority_created ON public.ocr_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_document_id ON public.ocr_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_case_id ON public.ocr_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_user_id ON public.ocr_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_retry_after ON public.ocr_queue(retry_after) WHERE status = 'failed';

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_ocr_queue_updated_at ON public.ocr_queue;
CREATE TRIGGER update_ocr_queue_updated_at
  BEFORE UPDATE ON public.ocr_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
