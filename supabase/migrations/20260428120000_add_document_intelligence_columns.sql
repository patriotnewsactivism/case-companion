-- Document Intelligence columns
-- Adds auto-naming, document type classification, and document date extraction
-- These columns are populated by the documentIntelligence service after OCR + AI analysis

-- Add columns if they don't already exist (safe to re-run)
DO $$
BEGIN
  -- AI-suggested document name (e.g. "Police Report - 2024-03-15")
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'ai_suggested_name'
  ) THEN
    ALTER TABLE documents ADD COLUMN ai_suggested_name text;
  END IF;

  -- Document type classification (police_report, medical_record, contract, etc.)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE documents ADD COLUMN document_type text;
  END IF;

  -- Extracted document date (the date the document was created/signed/filed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'document_date'
  ) THEN
    ALTER TABLE documents ADD COLUMN document_date date;
  END IF;

  -- OCR provider used (tracks which tier succeeded)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'ocr_provider'
  ) THEN
    ALTER TABLE documents ADD COLUMN ocr_provider text;
  END IF;

  -- Timestamp when OCR was processed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'ocr_processed_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN ocr_processed_at timestamptz;
  END IF;

  -- Extracted tables from Azure Document Intelligence
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'extracted_tables'
  ) THEN
    ALTER TABLE documents ADD COLUMN extracted_tables jsonb;
  END IF;
END $$;

-- Index for chronological Bates ordering
CREATE INDEX IF NOT EXISTS idx_documents_case_date
  ON documents (case_id, document_date NULLS LAST, created_at);

-- Index for document type filtering
CREATE INDEX IF NOT EXISTS idx_documents_document_type
  ON documents (document_type)
  WHERE document_type IS NOT NULL;

-- Comment the columns
COMMENT ON COLUMN documents.ai_suggested_name IS 'AI-generated descriptive name based on document content analysis';
COMMENT ON COLUMN documents.document_type IS 'Classified document type: police_report, medical_record, court_filing, etc.';
COMMENT ON COLUMN documents.document_date IS 'Extracted date the document was created/signed/filed';
COMMENT ON COLUMN documents.ocr_provider IS 'Which OCR tier successfully processed this document';
COMMENT ON COLUMN documents.ocr_processed_at IS 'When OCR processing completed';
COMMENT ON COLUMN documents.extracted_tables IS 'Structured table data extracted by Azure Document Intelligence';
