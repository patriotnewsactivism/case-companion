-- Agent Memory: persistent memory store for AI agents
create table if not exists agent_memory (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  case_id text not null,
  memory_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- unique constraint so each agent/case pair has exactly one memory row
alter table agent_memory add constraint agent_memory_agent_case_unique unique (agent_id, case_id);

create index if not exists idx_agent_memory_agent_case on agent_memory(agent_id, case_id);

alter table agent_memory enable row level security;

drop policy if exists "Users read own agent memory" on agent_memory;
create policy "Users read own agent memory" on agent_memory
  for select using (
    exists (select 1 from cases where cases.id::text = agent_memory.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users insert own agent memory" on agent_memory;
create policy "Users insert own agent memory" on agent_memory
  for insert with check (
    exists (select 1 from cases where cases.id::text = agent_memory.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users update own agent memory" on agent_memory;
create policy "Users update own agent memory" on agent_memory
  for update using (
    exists (select 1 from cases where cases.id::text = agent_memory.case_id and cases.user_id = auth.uid())
  );

-- Agent Workflows: persisted workflow execution state
create table if not exists agent_workflows (
  id text primary key,
  case_id text,
  case_title text,
  name text not null,
  description text,
  trigger_event text default 'manual',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  steps jsonb not null default '[]'::jsonb,
  result jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_agent_workflows_case on agent_workflows(case_id);
create index if not exists idx_agent_workflows_status on agent_workflows(status);

alter table agent_workflows enable row level security;

drop policy if exists "Users read own workflows" on agent_workflows;
create policy "Users read own workflows" on agent_workflows
  for select using (
    case_id is null or
    exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users insert own workflows" on agent_workflows;
create policy "Users insert own workflows" on agent_workflows
  for insert with check (
    case_id is null or
    exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users update own workflows" on agent_workflows;
create policy "Users update own workflows" on agent_workflows
  for update using (
    case_id is null or
    exists (select 1 from cases where cases.id::text = agent_workflows.case_id and cases.user_id = auth.uid())
  );

-- Agent Insights: standalone table for cross-case agent insights
create table if not exists agent_insights (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  case_id text not null,
  title text not null,
  content text not null,
  confidence integer not null default 70 check (confidence >= 0 and confidence <= 100),
  insight_type text not null default 'recommendation'
    check (insight_type in ('risk', 'opportunity', 'pattern', 'recommendation', 'alert')),
  source text not null default 'analysis'
    check (source in ('analysis', 'monitoring', 'research', 'learning')),
  read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_agent_insights_case on agent_insights(case_id);
create index if not exists idx_agent_insights_agent on agent_insights(agent_id);
create index if not exists idx_agent_insights_unread on agent_insights(read) where read = false;

alter table agent_insights enable row level security;

drop policy if exists "Users read own insights" on agent_insights;
create policy "Users read own insights" on agent_insights
  for select using (
    exists (select 1 from cases where cases.id::text = agent_insights.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users insert own insights" on agent_insights;
create policy "Users insert own insights" on agent_insights
  for insert with check (
    exists (select 1 from cases where cases.id::text = agent_insights.case_id and cases.user_id = auth.uid())
  );

drop policy if exists "Users update own insights" on agent_insights;
create policy "Users update own insights" on agent_insights
  for update using (
    exists (select 1 from cases where cases.id::text = agent_insights.case_id and cases.user_id = auth.uid())
  );

-- Enable Realtime for workflow progress tracking
alter publication supabase_realtime add table agent_workflows;
alter publication supabase_realtime add table agent_insights;
