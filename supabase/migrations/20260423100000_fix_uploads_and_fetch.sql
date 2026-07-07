-- ============================================================
-- Fix document uploads and fetching
-- ============================================================

-- 1. Make case-documents bucket public and increase size limit
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 524288000,  -- 500MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/tiff',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/octet-stream'
  ]
WHERE id = 'case-documents';

-- 2. Drop all conflicting storage policies and replace with clean ones
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_delete" ON storage.objects;

-- Public read (bucket is public, but RLS still applies - allow all reads)
CREATE POLICY "case_documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'case-documents');

-- Authenticated upload - path must start with user's own ID
CREATE POLICY "case_documents_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated update
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

-- Authenticated delete
CREATE POLICY "case_documents_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Ensure documents table RLS is simple and working
-- Drop any complex role-based policies that reference missing functions
DROP POLICY IF EXISTS "Users can view documents in accessible cases" ON public.documents;
DROP POLICY IF EXISTS "Authorized roles can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authorized roles can update documents" ON public.documents;
DROP POLICY IF EXISTS "Owners and partners can delete documents" ON public.documents;

-- Restore simple user_id-based policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
