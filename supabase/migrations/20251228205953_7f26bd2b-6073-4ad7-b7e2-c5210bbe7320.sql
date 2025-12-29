-- Storage bucket is already created in earlier migration (20251227200000_create_case_documents_bucket.sql)
-- Just ensure it exists with proper settings
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Storage policies for case-documents bucket
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own case documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own case documents" ON storage.objects;

-- Users can view their own documents
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload to their own folder
CREATE POLICY "Users can upload their own case documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own documents
CREATE POLICY "Users can update their own case documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own case documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add OCR result columns to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_page_count INTEGER,
ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMP WITH TIME ZONE;