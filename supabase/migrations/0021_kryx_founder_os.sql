-- KryxAI founder OS foundation.
-- Adds only durable product state that does not already live in agents,
-- generations, leads, scheduled_tasks, room_messages or chat_messages.

create table if not exists agentstack.connected_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'github' check (provider in ('github')),
  repo_full_name text not null,
  repo_url text not null,
  default_branch text not null default 'main',
  installation_id text,
  seo_root text not null default '/',
  can_write boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, repo_full_name)
);

create table if not exists agentstack.seo_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_id uuid references agentstack.connected_repositories(id) on delete set null,
  agent_id uuid references agentstack.agents(id) on delete set null,
  status text not null default 'researched' check (status in ('researched','drafted','waiting_approval','approved','publishing','published','failed','rejected')),
  query text,
  search_intent text,
  slug text,
  title text,
  evidence jsonb not null default '[]'::jsonb,
  draft_path text,
  draft_content text,
  commit_sha text,
  published_url text,
  error text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agentstack.startup_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  window_start timestamptz,
  window_end timestamptz,
  visitors bigint,
  sessions bigint,
  signups bigint,
  activated_users bigint,
  paid_customers bigint,
  revenue_cents bigint,
  ad_spend_cents bigint,
  avg_session_seconds numeric,
  signup_conversion numeric,
  paid_conversion numeric,
  cac_cents bigint,
  ltv_cents bigint,
  source_breakdown jsonb not null default '{}'::jsonb,
  geo_breakdown jsonb not null default '{}'::jsonb,
  funnel jsonb not null default '{}'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  source_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agentstack.founder_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agentstack.agents(id) on delete set null,
  kind text not null check (kind in ('diagnosis','trend','milestone','approval','briefing','system')),
  severity text not null default 'normal' check (severity in ('low','normal','high','urgent')),
  title text not null,
  body text not null,
  channel text not null default 'dashboard' check (channel in ('dashboard','telegram','voice')),
  dedupe_key text,
  meta jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists founder_notifications_dedupe_idx
  on agentstack.founder_notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists agentstack.agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_agent_id uuid references agentstack.agents(id) on delete set null,
  to_agent_id uuid references agentstack.agents(id) on delete set null,
  generation_id uuid references agentstack.generations(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','accepted','completed','blocked','cancelled')),
  needs_head_approval boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rich chat/voice/image support. Existing text chat remains valid.
alter table agentstack.chat_messages
  add column if not exists content_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists transcript text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists connected_repositories_user_idx
  on agentstack.connected_repositories(user_id, enabled);
create index if not exists seo_jobs_user_status_idx
  on agentstack.seo_jobs(user_id, status, created_at desc);
create index if not exists startup_health_user_time_idx
  on agentstack.startup_health_snapshots(user_id, captured_at desc);
create index if not exists founder_notifications_user_time_idx
  on agentstack.founder_notifications(user_id, created_at desc);
create index if not exists agent_handoffs_user_status_idx
  on agentstack.agent_handoffs(user_id, status, created_at desc);

alter table agentstack.connected_repositories enable row level security;
alter table agentstack.seo_jobs enable row level security;
alter table agentstack.startup_health_snapshots enable row level security;
alter table agentstack.founder_notifications enable row level security;
alter table agentstack.agent_handoffs enable row level security;

create policy "owners read connected repositories" on agentstack.connected_repositories
  for select using (auth.uid() = user_id);
create policy "owners manage connected repositories" on agentstack.connected_repositories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read seo jobs" on agentstack.seo_jobs
  for select using (auth.uid() = user_id);
create policy "owners manage seo approvals" on agentstack.seo_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read startup health" on agentstack.startup_health_snapshots
  for select using (auth.uid() = user_id);

create policy "owners read notifications" on agentstack.founder_notifications
  for select using (auth.uid() = user_id);
create policy "owners update notifications" on agentstack.founder_notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read handoffs" on agentstack.agent_handoffs
  for select using (auth.uid() = user_id);

-- Service-role workers insert operational state; authenticated founders mainly read
-- and approve. Existing project convention grants table access and relies on RLS.
grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
