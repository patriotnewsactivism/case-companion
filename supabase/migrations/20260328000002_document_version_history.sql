-- Migration: Document Version History
-- Tracks every change to a document by snapshotting the previous state
-- into a document_versions table before each update.

-- Add current_version to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

-- Create document_versions table
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  bates_number TEXT,
  summary TEXT,
  key_facts TEXT[],
  favorable_findings TEXT[],
  adverse_findings TEXT[],
  action_items TEXT[],
  ocr_text TEXT,
  change_description TEXT,
  change_type TEXT CHECK (change_type IN ('edit', 'reanalysis', 'file_replace', 'rollback')),
  diff_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_version
  ON public.document_versions (document_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_document_versions_user_id
  ON public.document_versions (user_id);

-- Enable RLS
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can view and create versions they own
DROP POLICY IF EXISTS "Users can view their own document versions" ON public.document_versions;
CREATE POLICY "Users can view their own document versions"
  ON public.document_versions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own document versions" ON public.document_versions;
CREATE POLICY "Users can insert their own document versions"
  ON public.document_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger function: snapshot the OLD row into document_versions before update
CREATE OR REPLACE FUNCTION public.snapshot_document_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot when tracked fields actually change
  IF (OLD.name IS DISTINCT FROM NEW.name)
     OR (OLD.file_url IS DISTINCT FROM NEW.file_url)
     OR (OLD.summary IS DISTINCT FROM NEW.summary)
     OR (OLD.ocr_text IS DISTINCT FROM NEW.ocr_text)
     OR (OLD.key_facts IS DISTINCT FROM NEW.key_facts)
  THEN
    INSERT INTO public.document_versions (
      document_id,
      version_number,
      user_id,
      name,
      file_url,
      file_type,
      file_size,
      bates_number,
      summary,
      key_facts,
      favorable_findings,
      adverse_findings,
      action_items,
      ocr_text,
      change_description,
      change_type,
      diff_summary
    ) VALUES (
      OLD.id,
      COALESCE(OLD.current_version, 1),
      OLD.user_id,
      OLD.name,
      OLD.file_url,
      OLD.file_type,
      OLD.file_size,
      OLD.bates_number,
      OLD.summary,
      OLD.key_facts,
      OLD.favorable_findings,
      OLD.adverse_findings,
      OLD.action_items,
      OLD.ocr_text,
      CASE
        WHEN OLD.file_url IS DISTINCT FROM NEW.file_url THEN 'File replaced'
        WHEN OLD.summary IS DISTINCT FROM NEW.summary OR OLD.key_facts IS DISTINCT FROM NEW.key_facts THEN 'Analysis updated'
        WHEN OLD.name IS DISTINCT FROM NEW.name THEN 'Document renamed'
        ELSE 'Document updated'
      END,
      CASE
        WHEN OLD.file_url IS DISTINCT FROM NEW.file_url THEN 'file_replace'
        WHEN OLD.summary IS DISTINCT FROM NEW.summary OR OLD.ocr_text IS DISTINCT FROM NEW.ocr_text THEN 'reanalysis'
        ELSE 'edit'
      END,
      jsonb_build_object(
        'name_changed', OLD.name IS DISTINCT FROM NEW.name,
        'file_changed', OLD.file_url IS DISTINCT FROM NEW.file_url,
        'summary_changed', OLD.summary IS DISTINCT FROM NEW.summary,
        'ocr_text_changed', OLD.ocr_text IS DISTINCT FROM NEW.ocr_text,
        'key_facts_changed', OLD.key_facts IS DISTINCT FROM NEW.key_facts
      )
    );

    -- Increment the version counter on the document
    NEW.current_version := COALESCE(OLD.current_version, 1) + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger (BEFORE UPDATE so we can modify NEW.current_version)
DROP TRIGGER IF EXISTS snapshot_document_version_trigger ON public.documents;
CREATE TRIGGER snapshot_document_version_trigger
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_document_version();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
