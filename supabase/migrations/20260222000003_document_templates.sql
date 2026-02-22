-- Document Templates System Migration
-- Manages reusable document templates and generated documents

-- Create template category enum
DO $$ BEGIN
  CREATE TYPE public.template_category AS ENUM ('motion', 'brief', 'pleading', 'letter', 'discovery', 'agreement', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create export format enum
DO $$ BEGIN
  CREATE TYPE public.export_format AS ENUM ('docx', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create document templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.template_category NOT NULL,
  subcategory TEXT,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  jurisdiction TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated documents table
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  variables_used JSONB DEFAULT '{}'::jsonb,
  word_count INTEGER,
  export_format public.export_format NOT NULL DEFAULT 'docx',
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- Document templates policies
DROP POLICY IF EXISTS "Users can view public templates" ON public.document_templates;
CREATE POLICY "Users can view public templates"
  ON public.document_templates FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create templates" ON public.document_templates;
CREATE POLICY "Users can create templates"
  ON public.document_templates FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their templates" ON public.document_templates;
CREATE POLICY "Users can update their templates"
  ON public.document_templates FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their templates" ON public.document_templates;
CREATE POLICY "Users can delete their templates"
  ON public.document_templates FOR DELETE
  USING (created_by = auth.uid());

-- Generated documents policies
DROP POLICY IF EXISTS "Users can view their generated documents" ON public.generated_documents;
CREATE POLICY "Users can view their generated documents"
  ON public.generated_documents FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create generated documents" ON public.generated_documents;
CREATE POLICY "Users can create generated documents"
  ON public.generated_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their generated documents" ON public.generated_documents;
CREATE POLICY "Users can update their generated documents"
  ON public.generated_documents FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their generated documents" ON public.generated_documents;
CREATE POLICY "Users can delete their generated documents"
  ON public.generated_documents FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_category ON public.document_templates(category);
CREATE INDEX IF NOT EXISTS idx_document_templates_created_by ON public.document_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_document_templates_is_public ON public.document_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_document_templates_jurisdiction ON public.document_templates(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_generated_documents_case_id ON public.generated_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON public.generated_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_template_id ON public.generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_created_at ON public.generated_documents(created_at DESC);

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.document_templates
  SET usage_count = usage_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to increment usage on document generation
DROP TRIGGER IF EXISTS increment_template_usage ON public.generated_documents;
CREATE TRIGGER increment_template_usage
  AFTER INSERT ON public.generated_documents
  FOR EACH ROW
  WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION public.increment_template_usage();

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_generated_documents_updated_at ON public.generated_documents;
CREATE TRIGGER update_generated_documents_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
