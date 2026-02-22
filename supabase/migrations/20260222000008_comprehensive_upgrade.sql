-- Comprehensive Upgrade Migration
-- Safely applies all migrations with IF NOT EXISTS checks
-- This is a composite migration that ensures all tables exist

-- =================================================================
-- PART 1: OCR Queue System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.ocr_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ocr_provider AS ENUM ('azure', 'ocr_space', 'gemini');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.ocr_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.ocr_status NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  provider public.ocr_provider,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  retry_after TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.ocr_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ocr_queue' AND policyname = 'Users can view their own OCR queue items') THEN
    CREATE POLICY "Users can view their own OCR queue items" ON public.ocr_queue FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ocr_queue' AND policyname = 'Users can insert their own OCR queue items') THEN
    CREATE POLICY "Users can insert their own OCR queue items" ON public.ocr_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ocr_queue' AND policyname = 'Users can update their own OCR queue items') THEN
    CREATE POLICY "Users can update their own OCR queue items" ON public.ocr_queue FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ocr_queue' AND policyname = 'Users can delete their own OCR queue items') THEN
    CREATE POLICY "Users can delete their own OCR queue items" ON public.ocr_queue FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ocr_queue_status_priority_created ON public.ocr_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_document_id ON public.ocr_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_case_id ON public.ocr_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_user_id ON public.ocr_queue(user_id);

-- =================================================================
-- PART 2: Realtime Presence System
-- =================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.cases;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.ocr_queue;

CREATE TABLE IF NOT EXISTS public.case_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT,
  user_avatar_url TEXT,
  cursor_position JSONB DEFAULT '{}'::jsonb,
  current_section TEXT,
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_case_user UNIQUE (case_id, user_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.case_presence;

ALTER TABLE public.case_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_presence' AND policyname = 'Users can view presence in their cases') THEN
    CREATE POLICY "Users can view presence in their cases" ON public.case_presence FOR SELECT USING (EXISTS (SELECT 1 FROM public.cases WHERE cases.id = case_presence.case_id AND cases.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_presence' AND policyname = 'Users can insert their own presence') THEN
    CREATE POLICY "Users can insert their own presence" ON public.case_presence FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_presence' AND policyname = 'Users can update their own presence') THEN
    CREATE POLICY "Users can update their own presence" ON public.case_presence FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_presence' AND policyname = 'Users can delete their own presence') THEN
    CREATE POLICY "Users can delete their own presence" ON public.case_presence FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_case_presence_case_id ON public.case_presence(case_id);
CREATE INDEX IF NOT EXISTS idx_case_presence_user_id ON public.case_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_case_presence_last_active ON public.case_presence(last_active);

-- =================================================================
-- PART 3: Client Portal System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.client_access_level AS ENUM ('view', 'comment', 'upload', 'full');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sender_type AS ENUM ('attorney', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  access_level public.client_access_level NOT NULL DEFAULT 'view',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  password_hash TEXT,
  magic_link_token TEXT,
  magic_link_expires TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_email_case UNIQUE (email, case_id)
);

CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  sender_type public.sender_type NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_portal_users_case_id ON public.client_portal_users(case_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_email ON public.client_portal_users(email);
CREATE INDEX IF NOT EXISTS idx_client_documents_case_id ON public.client_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_case_id ON public.client_messages(case_id);

-- =================================================================
-- PART 4: Document Templates System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.template_category AS ENUM ('motion', 'brief', 'pleading', 'letter', 'discovery', 'agreement', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.export_format AS ENUM ('docx', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_templates_category ON public.document_templates(category);
CREATE INDEX IF NOT EXISTS idx_document_templates_created_by ON public.document_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_document_templates_is_public ON public.document_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_generated_documents_case_id ON public.generated_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON public.generated_documents(user_id);

-- =================================================================
-- PART 5: Analytics System
-- =================================================================

CREATE TABLE IF NOT EXISTS public.case_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  documents_count INTEGER NOT NULL DEFAULT 0,
  documents_analyzed INTEGER NOT NULL DEFAULT 0,
  total_pages INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  audio_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  video_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  timeline_events INTEGER NOT NULL DEFAULT 0,
  discovery_requests INTEGER NOT NULL DEFAULT 0,
  evidence_analyses INTEGER NOT NULL DEFAULT 0,
  mock_jury_sessions INTEGER NOT NULL DEFAULT 0,
  trial_prep_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  estimated_time_saved_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  win_probability DECIMAL(5, 2),
  predicted_outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  resource_id UUID,
  resource_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_case_analytics_case_id ON public.case_analytics(case_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON public.usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);

-- =================================================================
-- PART 6: Audit and Security System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM ('create', 'read', 'update', 'delete', 'export', 'share');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_level AS ENUM ('read', 'write', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sensitivity_level AS ENUM ('public', 'internal', 'confidential', 'restricted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'sensitivity_level') THEN
    ALTER TABLE public.documents ADD COLUMN sensitivity_level public.sensitivity_level DEFAULT 'internal';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  geolocation JSONB,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  retention_until TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 year'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rotated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_level public.permission_level NOT NULL DEFAULT 'read',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_case_id ON public.encryption_keys(case_id);
CREATE INDEX IF NOT EXISTS idx_access_permissions_user_id ON public.access_permissions(user_id);

-- =================================================================
-- PART 7: Calendar Sync System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook', 'apple');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider public.calendar_provider NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.synced_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_date_id UUID,
  integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  provider public.calendar_provider NOT NULL,
  last_synced TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_status public.sync_status NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_integration_event UNIQUE (integration_id, external_event_id)
);

ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user_id ON public.calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_synced_calendar_events_integration_id ON public.synced_calendar_events(integration_id);

-- =================================================================
-- PART 8: Case Strategy System
-- =================================================================

DO $$ BEGIN
  CREATE TYPE public.analysis_type AS ENUM ('swot', 'outcome_prediction', 'timeline', 'settlement');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.case_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  analysis_type public.analysis_type NOT NULL,
  strengths TEXT[] DEFAULT '{}'::text[],
  weaknesses TEXT[] DEFAULT '{}'::text[],
  opportunities TEXT[] DEFAULT '{}'::text[],
  threats TEXT[] DEFAULT '{}'::text[],
  win_probability DECIMAL(5, 2) CHECK (win_probability >= 0 AND win_probability <= 100),
  predicted_outcome TEXT,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  settlement_range JSONB DEFAULT '{}'::jsonb,
  key_factors JSONB DEFAULT '[]'::jsonb,
  risk_assessment JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.case_strategies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_strategies' AND policyname = 'Users can view their case strategies') THEN
    CREATE POLICY "Users can view their case strategies" ON public.case_strategies FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_strategies' AND policyname = 'Users can create case strategies') THEN
    CREATE POLICY "Users can create case strategies" ON public.case_strategies FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_strategies' AND policyname = 'Users can update their case strategies') THEN
    CREATE POLICY "Users can update their case strategies" ON public.case_strategies FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'case_strategies' AND policyname = 'Users can delete their case strategies') THEN
    CREATE POLICY "Users can delete their case strategies" ON public.case_strategies FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_case_strategies_case_id ON public.case_strategies(case_id);
CREATE INDEX IF NOT EXISTS idx_case_strategies_user_id ON public.case_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_case_strategies_analysis_type ON public.case_strategies(analysis_type);

-- =================================================================
-- Refresh schema cache
-- =================================================================

NOTIFY pgrst, 'reload schema';
