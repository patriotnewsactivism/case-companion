-- Phase 1A: Secure Storage Bucket
-- CRITICAL SECURITY FIX: Make case-documents bucket private with RLS policies

-- Remove public access from case-documents bucket
UPDATE storage.buckets
SET public = false
WHERE id = 'case-documents';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;

-- Create RLS policies for authenticated access only
-- Policy 1: Users can view documents in their own user folder
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can upload to their own folders only
CREATE POLICY "Users can upload to their own folders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'case-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Verify the bucket is now private
DO $$
DECLARE
  is_public boolean;
BEGIN
  SELECT public INTO is_public
  FROM storage.buckets
  WHERE id = 'case-documents';

  IF is_public THEN
    RAISE EXCEPTION '✗ SECURITY ERROR: case-documents bucket is still public!';
  ELSE
    RAISE NOTICE '✓ SECURITY FIX APPLIED: case-documents bucket is now private with RLS';
  END IF;
END $$;
