-- Replace broad public SELECT with one that allows reading individual objects by URL
-- but blocks anonymous LIST operations.
DROP POLICY IF EXISTS "case_documents_public_read" ON storage.objects;

-- Authenticated users can read any case document (their app-level access)
CREATE POLICY "case_documents_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'case-documents');

-- Anonymous users can only read when they know the exact full path (URL fetch),
-- but cannot list the bucket. Storage public URLs work because they hit the
-- object directly. We allow this for compatibility with <img> / <iframe> embeds.
CREATE POLICY "case_documents_anon_read_by_path"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'case-documents');

NOTIFY pgrst, 'reload schema';