-- Make case-documents public and reset storage policies cleanly
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = NULL  -- allow any mime; client validates
WHERE id = 'case-documents';

-- Drop any older / conflicting policies on storage.objects for this bucket
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_public_read" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_delete" ON storage.objects;

-- Public read (bucket is public)
CREATE POLICY "case_documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'case-documents');

-- Authenticated upload — owner folder must match auth uid
CREATE POLICY "case_documents_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
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

NOTIFY pgrst, 'reload schema';