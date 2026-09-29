-- Kryx hybrid device execution — durable missions, approvals, evidence and dispatch.
-- Shared by macOS and Android. Additive only.

create table if not exists agentstack.hybrid_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text,
  instruction text not null check (char_length(instruction) between 1 and 4000),
  requested_execution text not null default 'auto'
    check (requested_execution in ('auto','cloud','macos','android')),
  selected_device_id uuid references agentstack.devices(id) on delete set null,
  status text not null default 'queued'
    check (status in (
      'queued','planning','running','waiting_for_device','waiting_for_user',
      'blocked','verifying','completed','failed','cancelled'
    )),
  planner jsonb not null default '{}'::jsonb,
  summary text,
  estimated_credits integer,
  credits_used integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists hybrid_missions_user_status_idx
  on agentstack.hybrid_missions(user_id, status, created_at desc);
create index if not exists hybrid_missions_device_idx
  on agentstack.hybrid_missions(selected_device_id, status, created_at)
  where selected_device_id is not null;

alter table agentstack.hybrid_missions enable row level security;
create policy "owners read hybrid missions"
  on agentstack.hybrid_missions for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.hybrid_missions from anon, authenticated;
grant select on agentstack.hybrid_missions to authenticated;
grant all on agentstack.hybrid_missions to service_role;


create table if not exists agentstack.hybrid_mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  agent_template_id text,
  label text not null check (char_length(label) between 1 and 240),
  execution text not null check (execution in ('cloud','device')),
  required_capabilities text[] not null default '{}',
  status text not null default 'queued'
    check (status in (
      'queued','running','waiting_for_device','waiting_for_user',
      'blocked','verifying','completed','failed','cancelled'
    )),
  depends_on uuid[] not null default '{}',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (mission_id, ordinal)
);

create index if not exists hybrid_steps_mission_idx
  on agentstack.hybrid_mission_steps(mission_id, ordinal);
create index if not exists hybrid_steps_status_idx
  on agentstack.hybrid_mission_steps(user_id, status, created_at);

alter table agentstack.hybrid_mission_steps enable row level security;
create policy "owners read hybrid mission steps"
  on agentstack.hybrid_mission_steps for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.hybrid_mission_steps from anon, authenticated;
grant select on agentstack.hybrid_mission_steps to authenticated;
grant all on agentstack.hybrid_mission_steps to service_role;


create table if not exists agentstack.device_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid not null references agentstack.hybrid_mission_steps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,

  task_type text not null,
  instruction text not null,
  payload jsonb not null default '{}'::jsonb,
  required_capabilities text[] not null default '{}',
  allowed_actions text[] not null default '{}',
  risk_level integer not null default 1 check (risk_level between 1 and 3),

  status text not null default 'queued'
    check (status in (
      'queued','claimed','running','waiting_for_user','blocked',
      'verifying','completed','failed','cancelled'
    )),
  nonce uuid not null default gen_random_uuid(),
  envelope_version integer not null default 1,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  attempt integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),

  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  error_code text,
  error_message text,

  unique (nonce)
);

create index if not exists device_tasks_dispatch_idx
  on agentstack.device_tasks(device_id, status, created_at)
  where status in ('queued','claimed','running','waiting_for_user','blocked','verifying');
create index if not exists device_tasks_mission_idx
  on agentstack.device_tasks(mission_id, created_at);

alter table agentstack.device_tasks enable row level security;
revoke all on agentstack.device_tasks from public, anon, authenticated;
grant all on agentstack.device_tasks to service_role;


create table if not exists agentstack.action_approvals (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid references agentstack.hybrid_mission_steps(id) on delete cascade,
  task_id uuid references agentstack.device_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_by text not null default 'kryx',
  action_type text not null,
  target text,
  description text not null,
  preview jsonb not null default '{}'::jsonb,
  risk_level integer not null check (risk_level in (2,3)),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','cancelled')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists action_approvals_user_pending_idx
  on agentstack.action_approvals(user_id, created_at desc)
  where status = 'pending';

alter table agentstack.action_approvals enable row level security;
create policy "owners read their action approvals"
  on agentstack.action_approvals for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.action_approvals from anon, authenticated;
grant select on agentstack.action_approvals to authenticated;
grant all on agentstack.action_approvals to service_role;


create table if not exists agentstack.task_evidence (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid references agentstack.hybrid_mission_steps(id) on delete cascade,
  task_id uuid references agentstack.device_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  kind text not null check (kind in (
    'source','fact','file','ui_receipt','action_receipt','metric','error','note'
  )),
  title text,
  source_url text,
  content jsonb not null default '{}'::jsonb,
  content_sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists task_evidence_mission_idx
  on agentstack.task_evidence(mission_id, created_at);

alter table agentstack.task_evidence enable row level security;
create policy "owners read their task evidence"
  on agentstack.task_evidence for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.task_evidence from anon, authenticated;
grant select on agentstack.task_evidence to authenticated;
grant all on agentstack.task_evidence to service_role;


create table if not exists agentstack.device_task_events (
  id bigserial primary key,
  task_id uuid not null references agentstack.device_tasks(id) on delete cascade,
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  event_type text not null,
  state text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_task_events_task_idx
  on agentstack.device_task_events(task_id, created_at);

alter table agentstack.device_task_events enable row level security;
create policy "owners read their device task events"
  on agentstack.device_task_events for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.device_task_events from anon, authenticated;
grant select on agentstack.device_task_events to authenticated;
grant all on agentstack.device_task_events to service_role;

notify pgrst, 'reload schema';
