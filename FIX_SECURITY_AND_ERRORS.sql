-- =============================================================================
-- FIX: Storage bucket data leak + missing tables + RLS hardening
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. STORAGE BUCKET: Fix critical data leak
-- DROP the policies that let ANY authenticated user read ANY file
DROP POLICY IF EXISTS "case_documents_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "case_documents_anon_read_by_path" ON storage.objects;
DROP POLICY IF EXISTS "Give anon user access to case documents" ON storage.objects;
DROP POLICY IF EXISTS "Anon can read case-documents" ON storage.objects;

-- CREATE per-user scoped read: users only see their own folder
CREATE POLICY "case_documents_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can read all (for processing)
CREATE POLICY "case_documents_select_service_role" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'case-documents');

-- 2. AGENT TABLES (create first, then set RLS)
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  memory_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, case_id)
);

CREATE TABLE IF NOT EXISTS agent_workflows (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  case_title TEXT,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 70 CHECK (confidence >= 0 AND confidence <= 100),
  insight_type TEXT NOT NULL DEFAULT 'recommendation'
    CHECK (insight_type IN ('risk', 'opportunity', 'pattern', 'recommendation', 'alert')),
  source TEXT NOT NULL DEFAULT 'analysis'
    CHECK (source IN ('analysis', 'monitoring', 'research', 'learning')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on agent tables
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_insights ENABLE ROW LEVEL SECURITY;

-- Agent tables indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_case ON agent_memory(agent_id, case_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_case ON agent_workflows(case_id);
CREATE INDEX IF NOT EXISTS idx_agent_insights_case ON agent_insights(case_id);
CREATE INDEX IF NOT EXISTS idx_agent_insights_unread ON agent_insights(read) WHERE read = false;

-- Agent workflows RLS
DROP POLICY IF EXISTS "Users read own workflows" ON agent_workflows;
DROP POLICY IF EXISTS "Users insert own workflows" ON agent_workflows;
DROP POLICY IF EXISTS "Users update own workflows" ON agent_workflows;

CREATE POLICY "Users read own workflows" ON agent_workflows
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_workflows.case_id AND cases.user_id = auth.uid())
  );

CREATE POLICY "Users insert own workflows" ON agent_workflows
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_workflows.case_id AND cases.user_id = auth.uid())
  );

CREATE POLICY "Users update own workflows" ON agent_workflows
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_workflows.case_id AND cases.user_id = auth.uid())
  );

-- Agent memory RLS
DROP POLICY IF EXISTS "Users read own agent memory" ON agent_memory;
CREATE POLICY "Users read own agent memory" ON agent_memory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_memory.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users insert own agent memory" ON agent_memory;
CREATE POLICY "Users insert own agent memory" ON agent_memory
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_memory.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users update own agent memory" ON agent_memory;
CREATE POLICY "Users update own agent memory" ON agent_memory
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_memory.case_id AND cases.user_id = auth.uid())
  );

-- Agent insights RLS
DROP POLICY IF EXISTS "Users read own insights" ON agent_insights;
CREATE POLICY "Users read own insights" ON agent_insights
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_insights.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users insert own insights" ON agent_insights;
CREATE POLICY "Users insert own insights" ON agent_insights
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_insights.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users update own insights" ON agent_insights;
CREATE POLICY "Users update own insights" ON agent_insights
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id::text = agent_insights.case_id AND cases.user_id = auth.uid())
  );

-- Enable Realtime for workflows
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS agent_workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS agent_insights;

-- 3. ORGANIZATIONS TABLE (creates if missing)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'partner', 'associate', 'paralegal', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organization RLS
DROP POLICY IF EXISTS "org_owner_all" ON organizations;
CREATE POLICY "org_owner_all" ON organizations
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "org_member_select" ON organizations;
CREATE POLICY "org_member_select" ON organizations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = organizations.id AND organization_members.user_id = auth.uid())
  );

-- Member RLS
DROP POLICY IF EXISTS "org_members_read" ON organization_members;
CREATE POLICY "org_members_read" ON organization_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM organizations WHERE organizations.id = organization_members.organization_id AND organizations.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM organizations WHERE organizations.id = organization_members.organization_id AND organizations.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_members_delete" ON organization_members;
CREATE POLICY "org_members_delete" ON organization_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM organizations WHERE organizations.id = organization_members.organization_id AND organizations.owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);

-- 4. TIME ENTRIES: Ensure table has user_id and RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'time_entries') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'time_entries' AND column_name = 'user_id') THEN
      ALTER TABLE time_entries ADD COLUMN user_id UUID DEFAULT auth.uid();
    END IF;

    ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can read own time entries" ON time_entries;
    DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
    DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
    DROP POLICY IF EXISTS "Users can delete own time entries" ON time_entries;

    CREATE POLICY "Users can read own time entries" ON time_entries
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users can insert own time entries" ON time_entries
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own time entries" ON time_entries
      FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users can delete own time entries" ON time_entries
      FOR DELETE USING (auth.uid() = user_id);

    CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
  END IF;
END $$;

-- 5. INVOICES RLS (if the table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users read own invoices" ON invoices;
    CREATE POLICY "Users read own invoices" ON invoices
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. CASE MEMBERS INDEXES
CREATE INDEX IF NOT EXISTS idx_case_members_case_id ON case_members(case_id);
CREATE INDEX IF NOT EXISTS idx_case_members_user_id ON case_members(user_id);


