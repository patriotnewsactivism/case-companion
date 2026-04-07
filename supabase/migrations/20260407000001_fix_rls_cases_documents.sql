-- Fix RLS policies for cases, documents, and processing_queue
--
-- Root causes addressed:
-- 1. documents INSERT policy used user_case_role() without also asserting
--    auth.uid() = user_id, making it looser than intended.
-- 2. processing_queue table had no RLS enabled.

-- =====================================================================
-- 1. Fix documents INSERT policy
--    Add auth.uid() = user_id assertion so each user can only create
--    documents attributed to themselves (case-role check remains for
--    team access, but the attributed user_id must be the requester).
-- =====================================================================

DROP POLICY IF EXISTS "Authorized roles can insert documents" ON public.documents;

CREATE POLICY "Authorized roles can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner', 'associate', 'paralegal')
  );

-- =====================================================================
-- 2. Enable RLS on processing_queue and add user-scoped policies.
--    The queue processor (service role) bypasses RLS automatically.
-- =====================================================================

ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own processing queue items" ON public.processing_queue;
CREATE POLICY "Users can view their own processing queue items"
  ON public.processing_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own processing queue items" ON public.processing_queue;
CREATE POLICY "Users can insert their own processing queue items"
  ON public.processing_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own processing queue items" ON public.processing_queue;
CREATE POLICY "Users can update their own processing queue items"
  ON public.processing_queue FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own processing queue items" ON public.processing_queue;
CREATE POLICY "Users can delete their own processing queue items"
  ON public.processing_queue FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================================
-- 3. Ensure storage policies cover the correct path format.
--    All paths must be: {user_id}/{case_id}/{hash}/{filename}
--    (storage.foldername(name))[1] must equal auth.uid()::text
--    These DROP/CREATE are idempotent — existing names are replaced.
-- =====================================================================

-- Clean up duplicate policy names from previous migrations
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;

CREATE POLICY "case_documents_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "case_documents_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "case_documents_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "case_documents_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
