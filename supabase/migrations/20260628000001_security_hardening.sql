-- ============================================================================
-- Security Hardening Migration
-- Fixes: storage bucket data leak, agent_workflows null case_id, misc gaps
-- ============================================================================

-- ── 1. Fix Storage Bucket RLS: Restrict authenticated reads to own files ───
-- Current policy allows ALL authenticated users to read ALL documents.
-- This fixes the critical data leak: User A can read User B's case documents.

-- Drop the overly permissive policies
drop policy if exists "case_documents_authenticated_read" on storage.objects;
drop policy if exists "case_documents_anon_read_by_path" on storage.objects;

-- Create per-user scoped read policy: users can only read objects in their
-- own folder path (foldername[1] = user_id)
create policy "case_documents_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create per-user scoped select for service role (admin reads)
create policy "case_documents_select_service_role" on storage.objects
  for select to service_role
  using (bucket_id = 'case-documents');

-- Remove anonymous access entirely
-- (anon_read_by_path was already dropped above; ensure no anon policy remains)
drop policy if exists "Give anon user access to case documents" on storage.objects;
drop policy if exists "Anon can read case-documents" on storage.objects;

-- ── 2. Fix agent_workflows null case_id policy ────────────────────────────
-- Previously any authenticated user could read workflows with null case_id.
-- Only run if agent_workflows table exists (created in migration 20260628000000).

do $$
begin
  if exists (select from information_schema.tables where table_name = 'agent_workflows') then
    drop policy if exists "Users read own workflows" on agent_workflows;
    drop policy if exists "Users insert own workflows" on agent_workflows;
    drop policy if exists "Users update own workflows" on agent_workflows;

    create policy "Users read own workflows" on agent_workflows
      for select using (
        exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
      );

    create policy "Users insert own workflows" on agent_workflows
      for insert with check (
        exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
      );

    create policy "Users update own workflows" on agent_workflows
      for update using (
        exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
      );
  end if;
end $$;

-- ── 3. Fix time_entries table if it exists without proper RLS ─────────────
-- The 400 errors suggest time_entries exists but may lack columns or RLS.
-- Ensure time_entries has a user_id column and RLS scoped to auth.uid().

do $$
begin
  if exists (select from information_schema.tables where table_name = 'time_entries') then
    -- Add user_id column if it doesn't exist
    if not exists (select from information_schema.columns where table_name = 'time_entries' and column_name = 'user_id') then
      alter table time_entries add column user_id uuid default auth.uid();
    end if;

    -- Enable RLS if not already enabled
    if not exists (select from pg_tables where tablename = 'time_entries' and rowsecurity = true) then
      alter table time_entries enable row level security;
    end if;

    -- Drop any existing overly-permissive policies
    drop policy if exists "Users can read own time entries" on time_entries;
    drop policy if exists "Users can insert own time entries" on time_entries;
    drop policy if exists "Users can update own time entries" on time_entries;
    drop policy if exists "Users can delete own time entries" on time_entries;

    -- Create scoped policies
    create policy "Users can read own time entries" on time_entries
      for select using (auth.uid() = user_id);

    create policy "Users can insert own time entries" on time_entries
      for insert with check (auth.uid() = user_id);

    create policy "Users can update own time entries" on time_entries
      for update using (auth.uid() = user_id);

    create policy "Users can delete own time entries" on time_entries
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── 4. Fix organizations table ──────────────────────────────────────────────
-- Create organizations table with full schema matching the app's Organization interface.

create table if not exists organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'partner', 'associate', 'paralegal', 'viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique(organization_id, user_id)
);

-- Enable RLS
alter table organizations enable row level security;
alter table organization_members enable row level security;

-- Organizations RLS
drop policy if exists "org_owner_all" on organizations;
create policy "org_owner_all" on organizations
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "org_member_select" on organizations;
create policy "org_member_select" on organizations
  for select using (
    exists (select 1 from organization_members where organization_members.organization_id = organizations.id and organization_members.user_id = auth.uid())
  );

-- Organization members RLS
drop policy if exists "org_members_read" on organization_members;
create policy "org_members_read" on organization_members
  for select using (
    auth.uid() = user_id
    or exists (select 1 from organizations where organizations.id = organization_members.organization_id and organizations.owner_id = auth.uid())
  );

drop policy if exists "org_members_insert" on organization_members;
create policy "org_members_insert" on organization_members
  for insert with check (
    exists (select 1 from organizations where organizations.id = organization_members.organization_id and organizations.owner_id = auth.uid())
  );

drop policy if exists "org_members_delete" on organization_members;
create policy "org_members_delete" on organization_members
  for delete using (
    exists (select 1 from organizations where organizations.id = organization_members.organization_id and organizations.owner_id = auth.uid())
  );

-- Indexes
create index if not exists idx_organization_members_org on organization_members(organization_id);
create index if not exists idx_organization_members_user on organization_members(user_id);

-- ── 5. Ensure billing tables have proper RLS ──────────────────────────────
do $$
begin
  if exists (select from information_schema.tables where table_name = 'invoices') then
    if not exists (select from pg_tables where tablename = 'invoices' and rowsecurity = true) then
      alter table invoices enable row level security;
    end if;

    drop policy if exists "Users read own invoices" on invoices;
    create policy "Users read own invoices" on invoices
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- ── 6. Ensure storage bucket exists and has proper config ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 104857600, array['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.ms-excel', 'message/rfc822', 'application/octet-stream'])
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.ms-excel', 'message/rfc822', 'application/octet-stream'];

-- ── 7. Add missing user_id index to key tables for query performance ───────
create index if not exists idx_time_entries_user_id on time_entries(user_id);
create index if not exists idx_case_members_case_id on case_members(case_id);
create index if not exists idx_case_members_user_id on case_members(user_id);
