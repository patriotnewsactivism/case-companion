-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('case-documents', 'case-documents', true);

-- Storage policies for case-documents bucket
-- Users can view their own documents
CREATE POLICY "Users can view their own case documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload to their own folder
CREATE POLICY "Users can upload their own case documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own documents
CREATE POLICY "Users can update their own case documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own documents
CREATE POLICY "Users can delete their own case documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add OCR result columns to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_page_count INTEGER,
ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMP WITH TIME ZONE;