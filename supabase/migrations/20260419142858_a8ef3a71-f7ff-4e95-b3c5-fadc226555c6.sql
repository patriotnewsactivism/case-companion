
-- =====================================================
-- Create all missing tables referenced by the codebase
-- =====================================================

-- Trial sessions (voice/courtroom practice sessions)
CREATE TABLE public.trial_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'opening',
  mode text NOT NULL DEFAULT 'practice',
  duration_seconds integer NOT NULL DEFAULT 0,
  transcript jsonb DEFAULT '[]'::jsonb,
  audio_url text,
  score numeric DEFAULT 0,
  metrics jsonb DEFAULT '{}'::jsonb,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trial_session_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.trial_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  metric_name text NOT NULL,
  metric_value numeric,
  metric_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trial_simulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  scenario text,
  transcript jsonb DEFAULT '[]'::jsonb,
  outcome text,
  score numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case collaboration
CREATE TABLE public.case_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_by uuid,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'active',
  invited_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, user_id)
);

CREATE TABLE public.case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  context_type text NOT NULL,
  content jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Discovery
CREATE TABLE public.discovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  request_type text NOT NULL,
  title text NOT NULL,
  description text,
  requesting_party text,
  responding_party text,
  served_date date,
  due_date date,
  response_date date,
  status text DEFAULT 'pending',
  request_text text,
  response_text text,
  objections text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Document versions / hash cache
CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  file_url text,
  file_size integer,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_hash_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_hash text NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, file_hash)
);

-- OCR & processing queues
CREATE TABLE public.ocr_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  priority integer DEFAULT 0,
  attempts integer DEFAULT 0,
  error_message text,
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority integer DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  attempts integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transcription_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_hash text NOT NULL,
  transcription text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, file_hash)
);

CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  file_url text,
  options jsonb DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- AI / analyses
CREATE TABLE public.ai_analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  analysis_type text NOT NULL,
  result jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_key)
);

CREATE TABLE public.evidence_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  evidence_description text NOT NULL,
  overall_admissibility text,
  confidence_score numeric DEFAULT 0,
  issues jsonb DEFAULT '[]'::jsonb,
  foundation_suggestions jsonb DEFAULT '[]'::jsonb,
  case_law_support jsonb DEFAULT '[]'::jsonb,
  reasoning text,
  motion_draft text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settlement_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  damages jsonb DEFAULT '{}'::jsonb,
  factors jsonb DEFAULT '{}'::jsonb,
  settlement_range jsonb DEFAULT '{}'::jsonb,
  recommendation text,
  confidence_score numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  strategy_type text,
  content jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_law_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  query text NOT NULL,
  jurisdiction text,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conflict_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  search_name text NOT NULL,
  search_type text,
  results jsonb DEFAULT '[]'::jsonb,
  conflicts_found integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.judicial_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  judge_name text NOT NULL,
  jurisdiction text,
  court text,
  profile_data jsonb DEFAULT '{}'::jsonb,
  rulings_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Mock jury
CREATE TABLE public.mock_jury_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  jury_composition jsonb DEFAULT '[]'::jsonb,
  argument_text text,
  verdicts jsonb DEFAULT '[]'::jsonb,
  deliberation jsonb DEFAULT '{}'::jsonb,
  final_verdict text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Motions
CREATE TABLE public.motion_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  motion_type text,
  jurisdiction text,
  template_text text NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.motion_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  suggestion_type text,
  motion_title text,
  rationale text,
  priority text DEFAULT 'medium',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.generated_motions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.motion_templates(id) ON DELETE SET NULL,
  motion_type text,
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'draft',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legal_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  brief_type text,
  title text NOT NULL,
  content text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.privilege_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  document_description text NOT NULL,
  document_date date,
  author text,
  recipients text,
  privilege_type text,
  privilege_basis text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Organizations / multi-tenant
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Client portal
CREATE TABLE public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_user_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  password_hash text,
  status text DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.client_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.token_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Rate limiting / API usage
CREATE TABLE public.rate_limit_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  method text,
  status_code integer,
  response_time_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Video room participants
CREATE TABLE public.video_room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_room_id uuid NOT NULL REFERENCES public.video_rooms(id) ON DELETE CASCADE,
  user_id uuid,
  participant_name text,
  participant_email text,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  role text DEFAULT 'participant',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- Helper function for case membership (avoids RLS recursion)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_case_member(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.case_members
    WHERE case_id = _case_id AND user_id = _user_id AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.cases
    WHERE id = _case_id AND user_id = _user_id
  );
$$;

-- =====================================================
-- Enable RLS on all new tables
-- =====================================================
ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_hash_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_law_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judicial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_jury_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motion_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motion_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_motions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privilege_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_room_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Standard owner-scoped RLS policies
-- =====================================================
DO $$
DECLARE
  t text;
  owner_tables text[] := ARRAY[
    'trial_sessions','trial_session_analytics','trial_simulation_sessions',
    'case_events','case_context','discovery_requests','document_versions',
    'document_hash_cache','ocr_queue','processing_queue','transcription_cache',
    'export_jobs','ai_analysis_cache','evidence_analyses','settlement_analyses',
    'case_strategies','case_law_research','conflict_checks','judicial_profiles',
    'mock_jury_sessions','motion_suggestions','generated_motions','legal_briefs',
    'privilege_log_entries','rate_limit_status','api_usage_log'
  ];
BEGIN
  FOREACH t IN ARRAY owner_tables LOOP
    EXECUTE format('CREATE POLICY "Users view own %I" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users insert own %I" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users update own %I" ON public.%I FOR UPDATE USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users delete own %I" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

-- case_members: owner of case can manage; members can view their own row
CREATE POLICY "Case owner manages members" ON public.case_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND user_id = auth.uid())
  );
CREATE POLICY "Members view own membership" ON public.case_members
  FOR SELECT USING (auth.uid() = user_id);

-- motion_templates: public templates viewable by all authenticated users; private owned
CREATE POLICY "View public or own templates" ON public.motion_templates
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Insert own templates" ON public.motion_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own templates" ON public.motion_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own templates" ON public.motion_templates
  FOR DELETE USING (auth.uid() = user_id);

-- organizations: owner manages
CREATE POLICY "Owner manages organization" ON public.organizations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Members view organization" ON public.organizations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.organization_members
            WHERE organization_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Org owner manages members" ON public.organization_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
  );
CREATE POLICY "Members view own org membership" ON public.organization_members
  FOR SELECT USING (auth.uid() = user_id);

-- client_portal_users: attorney manages their clients
CREATE POLICY "Attorney manages clients" ON public.client_portal_users
  FOR ALL USING (auth.uid() = attorney_user_id) WITH CHECK (auth.uid() = attorney_user_id);

-- client magic links / resets: only accessible via service role (no public policies)
-- Leaving RLS enabled with no policies blocks all client access by default

-- token_blacklist: service role only (no policies = no client access)

-- video_room_participants: case owner (room owner) manages; participant views own row
CREATE POLICY "Room owner views participants" ON public.video_room_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.video_rooms WHERE id = video_room_id AND user_id = auth.uid())
  );
CREATE POLICY "Room owner inserts participants" ON public.video_room_participants
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.video_rooms WHERE id = video_room_id AND user_id = auth.uid())
  );
CREATE POLICY "Participant views self" ON public.video_room_participants
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- updated_at triggers
-- =====================================================
DO $$
DECLARE
  t text;
  trigger_tables text[] := ARRAY[
    'trial_sessions','trial_simulation_sessions','case_members','case_context',
    'discovery_requests','ocr_queue','processing_queue','export_jobs',
    'case_strategies','judicial_profiles','motion_templates','generated_motions',
    'legal_briefs','organizations','client_portal_users','rate_limit_status'
  ];
BEGIN
  FOREACH t IN ARRAY trigger_tables LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;

-- =====================================================
-- Useful indexes
-- =====================================================
CREATE INDEX idx_trial_sessions_user_case ON public.trial_sessions(user_id, case_id);
CREATE INDEX idx_case_members_case ON public.case_members(case_id);
CREATE INDEX idx_case_members_user ON public.case_members(user_id);
CREATE INDEX idx_discovery_requests_case ON public.discovery_requests(case_id);
CREATE INDEX idx_document_versions_doc ON public.document_versions(document_id);
CREATE INDEX idx_ocr_queue_status ON public.ocr_queue(status, created_at);
CREATE INDEX idx_processing_queue_status ON public.processing_queue(status, created_at);
CREATE INDEX idx_processing_queue_user_case ON public.processing_queue(user_id, case_id);
CREATE INDEX idx_evidence_analyses_case ON public.evidence_analyses(case_id);
CREATE INDEX idx_settlement_analyses_case ON public.settlement_analyses(case_id);
CREATE INDEX idx_case_events_case ON public.case_events(case_id, created_at DESC);
CREATE INDEX idx_video_room_participants_room ON public.video_room_participants(video_room_id);
CREATE INDEX idx_token_blacklist_expires ON public.token_blacklist(expires_at);
CREATE INDEX idx_client_magic_links_token ON public.client_magic_links(token);
