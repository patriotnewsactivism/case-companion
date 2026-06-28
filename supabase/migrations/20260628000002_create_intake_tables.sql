-- Intake Cases: stores client intake submissions from the public intake form
-- and the AI-powered Maya receptionist.
create table if not exists intake_cases (
  id uuid default gen_random_uuid() primary key,
  firm_id text,
  full_name text not null default '',
  contact text not null default '',
  matter_type text not null default '',
  jurisdiction text not null default '',
  summary text not null default '',
  score integer not null default 0,
  disposition text not null default 'review'
    check (disposition in ('accepted', 'review', 'denied')),
  status text not null default 'new'
    check (status in ('new', 'accepted', 'denied', 'routed')),
  recommended_department text not null default '',
  recommended_agent_id text not null default '',
  urgency text not null default 'medium'
    check (urgency in ('low', 'medium', 'high')),
  intake jsonb not null default '{}'::jsonb,
  score_detail jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_intake_cases_status on intake_cases(status);
create index if not exists idx_intake_cases_created on intake_cases(created_at desc);

alter table intake_cases enable row level security;

-- Attorneys can read their firm's intakes
drop policy if exists "Users read own intakes" on intake_cases;
create policy "Users read own intakes" on intake_cases
  for select using (
    exists (select 1 from cases where cases.user_id = auth.uid())
    or firm_id is null
  );

drop policy if exists "Users insert intakes" on intake_cases;
create policy "Users insert intakes" on intake_cases
  for insert with check (true);

drop policy if exists "Users update own intakes" on intake_cases;
create policy "Users update own intakes" on intake_cases
  for update using (
    exists (select 1 from cases where cases.user_id = auth.uid())
  );

-- Client Invites: per-client tokens for secure intake links
create table if not exists client_invites (
  id uuid default gen_random_uuid() primary key,
  firm_id uuid,
  token text not null unique,
  client_name text not null,
  client_email text,
  client_phone text,
  message text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_client_invites_token on client_invites(token);

alter table client_invites enable row level security;

drop policy if exists "Users read own invites" on client_invites;
create policy "Users read own invites" on client_invites
  for select using (created_by = auth.uid());

drop policy if exists "Users insert invites" on client_invites;
create policy "Users insert invites" on client_invites
  for insert with check (created_by = auth.uid());

drop policy if exists "Users delete invites" on client_invites;
create policy "Users delete invites" on client_invites
  for delete using (created_by = auth.uid());
