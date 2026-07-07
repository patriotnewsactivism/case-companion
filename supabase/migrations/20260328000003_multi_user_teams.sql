-- Migration: Multi-User Teams
-- Introduces organizations, team membership, per-case member roles,
-- and rewrites RLS policies on cases/documents/timeline_events to
-- support shared access.

-- =====================================================================
-- 1. New tables
-- =====================================================================

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'partner', 'associate', 'paralegal', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Case members (per-case sharing)
CREATE TABLE IF NOT EXISTS public.case_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'partner', 'associate', 'paralegal', 'viewer')),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);

-- Add organization_id to cases
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- =====================================================================
-- 2. Indexes
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_case_members_case_id ON public.case_members(case_id);
CREATE INDEX IF NOT EXISTS idx_case_members_user_id ON public.case_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_organization_id ON public.cases(organization_id);

-- =====================================================================
-- 3. Helper functions
-- =====================================================================

-- Returns TRUE if a user owns the case or is listed in case_members
CREATE OR REPLACE FUNCTION public.user_has_case_access(check_case_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases WHERE id = check_case_id AND user_id = check_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.case_members WHERE case_id = check_case_id AND user_id = check_user_id
  );
$$;

-- Returns the effective role: 'owner' for the case creator, else role from case_members, else NULL
CREATE OR REPLACE FUNCTION public.user_case_role(check_case_id UUID, check_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM public.cases WHERE id = check_case_id AND user_id = check_user_id)
        THEN 'owner'
      ELSE (SELECT role FROM public.case_members WHERE case_id = check_case_id AND user_id = check_user_id LIMIT 1)
    END;
$$;

-- =====================================================================
-- 4. Enable RLS on new tables
-- =====================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_members ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. RLS policies for organizations
-- =====================================================================

DROP POLICY IF EXISTS "Org owners can do everything" ON public.organizations;
CREATE POLICY "Org owners can do everything"
  ON public.organizations FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
CREATE POLICY "Org members can view their org"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = id AND user_id = auth.uid()
    )
  );

-- =====================================================================
-- 6. RLS policies for organization_members
-- =====================================================================

DROP POLICY IF EXISTS "Org members can view membership list" ON public.organization_members;
CREATE POLICY "Org members can view membership list"
  ON public.organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org owners can manage members" ON public.organization_members;
CREATE POLICY "Org owners can manage members"
  ON public.organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_members.organization_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_members.organization_id
        AND owner_id = auth.uid()
    )
  );

-- =====================================================================
-- 7. RLS policies for case_members
-- =====================================================================

DROP POLICY IF EXISTS "Case members can view case membership" ON public.case_members;
CREATE POLICY "Case members can view case membership"
  ON public.case_members FOR SELECT
  USING (
    public.user_has_case_access(case_id, auth.uid())
  );

DROP POLICY IF EXISTS "Case owners can manage case members" ON public.case_members;
CREATE POLICY "Case owners can manage case members"
  ON public.case_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cases WHERE id = case_members.case_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases WHERE id = case_members.case_id AND user_id = auth.uid()
    )
  );

-- =====================================================================
-- 8. Rewrite RLS policies on cases
-- =====================================================================

-- Drop existing policies (exact names from base schema)
DROP POLICY IF EXISTS "Users can view their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can insert their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can update their own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can delete their own cases" ON public.cases;

-- SELECT: owner or any case_member
CREATE POLICY "Users can view accessible cases"
  ON public.cases FOR SELECT
  USING (
    public.user_has_case_access(id, auth.uid())
  );

-- INSERT: only the creator (becomes owner)
CREATE POLICY "Users can insert their own cases"
  ON public.cases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner or partner role
CREATE POLICY "Owners and partners can update cases"
  ON public.cases FOR UPDATE
  USING (
    public.user_case_role(id, auth.uid()) IN ('owner', 'partner')
  );

-- DELETE: owner only
CREATE POLICY "Only owners can delete cases"
  ON public.cases FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================================
-- 9. Rewrite RLS policies on documents
-- =====================================================================

DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- SELECT: anyone with case access
CREATE POLICY "Users can view documents in accessible cases"
  ON public.documents FOR SELECT
  USING (
    public.user_has_case_access(case_id, auth.uid())
  );

-- INSERT: owner, partner, associate, or paralegal
CREATE POLICY "Authorized roles can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner', 'associate', 'paralegal')
  );

-- UPDATE: owner, partner, or associate
CREATE POLICY "Authorized roles can update documents"
  ON public.documents FOR UPDATE
  USING (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner', 'associate')
  );

-- DELETE: owner or partner
CREATE POLICY "Owners and partners can delete documents"
  ON public.documents FOR DELETE
  USING (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner')
  );

-- =====================================================================
-- 10. Rewrite RLS policies on timeline_events
-- =====================================================================

DROP POLICY IF EXISTS "Users can view their own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Users can insert their own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Users can update their own timeline events" ON public.timeline_events;
DROP POLICY IF EXISTS "Users can delete their own timeline events" ON public.timeline_events;

-- SELECT: anyone with case access
CREATE POLICY "Users can view timeline events in accessible cases"
  ON public.timeline_events FOR SELECT
  USING (
    public.user_has_case_access(case_id, auth.uid())
  );

-- INSERT: owner, partner, associate, or paralegal
CREATE POLICY "Authorized roles can insert timeline events"
  ON public.timeline_events FOR INSERT
  WITH CHECK (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner', 'associate', 'paralegal')
  );

-- UPDATE: owner, partner, or associate
CREATE POLICY "Authorized roles can update timeline events"
  ON public.timeline_events FOR UPDATE
  USING (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner', 'associate')
  );

-- DELETE: owner or partner
CREATE POLICY "Owners and partners can delete timeline events"
  ON public.timeline_events FOR DELETE
  USING (
    public.user_case_role(case_id, auth.uid()) IN ('owner', 'partner')
  );

-- =====================================================================
-- 11. Updated_at triggers for new tables
-- =====================================================================

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
