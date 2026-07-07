-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  false,
  52428800, -- 50MB limit (increased from 20MB)
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;

-- Allow authenticated users to upload documents
CREATE POLICY "Users can upload their own case documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own documents
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own case documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own documents
CREATE POLICY "Users can update their own case documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'case-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'case-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
