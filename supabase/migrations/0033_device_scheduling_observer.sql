-- Kryx hybrid scheduling + Observer foundation.
-- Additive extensions to the existing scheduler; existing cloud schedules remain unchanged.

alter table agentstack.scheduled_tasks
  add column if not exists execution_target text not null default 'cloud',
  add column if not exists device_id uuid references agentstack.devices(id) on delete set null;

alter table agentstack.scheduled_tasks
  drop constraint if exists scheduled_tasks_execution_target_check;
alter table agentstack.scheduled_tasks
  add constraint scheduled_tasks_execution_target_check
  check (execution_target in ('cloud','auto','macos','android'));

create index if not exists scheduled_tasks_device_due_idx
  on agentstack.scheduled_tasks(device_id, status, run_at)
  where device_id is not null and status = 'pending';


create table if not exists agentstack.observer_settings (
  device_id uuid primary key references agentstack.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  excluded_apps text[] not null default '{}',
  anonymous_improvement boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table agentstack.observer_settings enable row level security;
create policy "owners read observer settings"
  on agentstack.observer_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.observer_settings from anon, authenticated;
grant select on agentstack.observer_settings to authenticated;
grant all on agentstack.observer_settings to service_role;


create table if not exists agentstack.device_observations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  observed_at timestamptz not null,
  app_id text not null,
  window_class text,
  event_type text not null,
  domain text,
  element_role text,
  -- Deliberately metadata-only. No typed body, email/DM text, screenshot or
  -- clipboard payload belongs in this table.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_observations_device_time_idx
  on agentstack.device_observations(device_id, observed_at desc);

alter table agentstack.device_observations enable row level security;
create policy "owners read sanitized observations"
  on agentstack.device_observations for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.device_observations from anon, authenticated;
grant select on agentstack.device_observations to authenticated;
grant all on agentstack.device_observations to service_role;


create table if not exists agentstack.detected_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  fingerprint text not null,
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  occurrences integer not null default 1,
  confidence numeric(4,3) not null default 0,
  status text not null default 'detected'
    check (status in ('detected','accepted','ignored','archived')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id, fingerprint)
);

alter table agentstack.detected_workflows enable row level security;
create policy "owners read detected workflows"
  on agentstack.detected_workflows for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.detected_workflows from anon, authenticated;
grant select on agentstack.detected_workflows to authenticated;
grant all on agentstack.detected_workflows to service_role;

notify pgrst, 'reload schema';
