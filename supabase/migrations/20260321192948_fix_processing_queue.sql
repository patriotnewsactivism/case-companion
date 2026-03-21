-- Rename table from typo processing_queue to correct processing_queue
ALTER TABLE IF EXISTS public.processing_queue RENAME TO processing_queue;

-- Rename indexes
DROP INDEX IF EXISTS idx_queue_status;
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, next_retry_at);

DROP INDEX IF EXISTS idx_queue_user;
CREATE INDEX IF NOT EXISTS idx_queue_user ON processing_queue(user_id, status);

DROP INDEX IF EXISTS idx_queue_case;
CREATE INDEX IF NOT EXISTS idx_queue_case ON processing_queue(case_id, status);

-- Enable Row Level Security on processing_queue table
ALTER TABLE IF EXISTS processing_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for processing_queue
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
