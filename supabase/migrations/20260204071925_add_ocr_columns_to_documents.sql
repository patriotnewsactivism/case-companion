-- Add missing OCR-related columns to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ocr_page_count INTEGER,
ADD COLUMN IF NOT EXISTS transcription_text TEXT;

-- Create index for OCR-processed documents
CREATE INDEX IF NOT EXISTS idx_documents_ocr_processed
ON public.documents(case_id, ocr_processed_at)
WHERE ocr_processed_at IS NOT NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
