-- Enable Row Level Security on processing_queue table
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for processing_queue
-- Users can view queue items for their own cases
CREATE POLICY "Users can view their own processing queue items"
  ON public.processing_queue FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = processing_queue.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- Users can insert their own processing queue items
CREATE POLICY "Users can insert their own processing queue items"
  ON public.processing_queue FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = processing_queue.case_id
      AND cases.user_id = auth.uid()
    )
  );

-- Service role can update processing queue items (for status changes by background workers)
CREATE POLICY "Service role can update processing queue"
  ON public.processing_queue FOR UPDATE
  USING (true);
