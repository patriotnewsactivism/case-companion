-- Enable RLS on processing_queue (note: using typo name as it exists in DB)
ALTER TABLE IF EXISTS processing_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Users can view their own processing queue items"
  ON processing_queue FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = processing_queue.case_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can insert their own processing queue items"
  ON processing_queue FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = processing_queue.case_id
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Service role can update processing queue"
  ON processing_queue FOR UPDATE
  USING (true);
