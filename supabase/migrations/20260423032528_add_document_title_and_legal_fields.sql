-- Add document title and legal analysis fields
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_importance TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS key_evidence TEXT[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS evidentiary_value TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_entities JSONB;
