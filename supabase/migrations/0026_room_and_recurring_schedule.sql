-- Repair Room storage and add founder-created recurring schedules.
--
-- Safe to run on databases that already have migrations 0012/0020: every table
-- and column creation is idempotent, and policies are recreated deliberately.

create table if not exists agentstack.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id uuid references agentstack.agents (id) on delete set null,
  template_id text,
  body text not null,
  mentions text[] not null default '{}',
  generation_id uuid references agentstack.generations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_user_idx
  on agentstack.room_messages (user_id, created_at desc);

alter table agentstack.room_messages enable row level security;
drop policy if exists "owners read their room" on agentstack.room_messages;
create policy "owners read their room"
  on agentstack.room_messages for select
  using (auth.uid() = user_id);
drop policy if exists "owners speak in their room" on agentstack.room_messages;
create policy "owners speak in their room"
  on agentstack.room_messages for insert
  with check (auth.uid() = user_id and agent_id is null);

create table if not exists agentstack.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  agent_id uuid references agentstack.agents on delete set null,
  instruction text not null check (length(instruction) between 1 and 2000),
  run_at timestamptz not null,
  when_label text,
  status text not null default 'pending'
    check (status in ('pending','done','failed','cancelled')),
  result text,
  error text,
  created_at timestamptz not null default now(),
  ran_at timestamptz
);

alter table agentstack.scheduled_tasks
  add column if not exists recurrence text not null default 'once';

alter table agentstack.scheduled_tasks
  add column if not exists timezone text not null default 'UTC';

alter table agentstack.scheduled_tasks
  drop constraint if exists scheduled_tasks_recurrence_check;

alter table agentstack.scheduled_tasks
  add constraint scheduled_tasks_recurrence_check
  check (recurrence in ('once','hourly','daily'));

create index if not exists scheduled_tasks_due_idx
  on agentstack.scheduled_tasks (status, run_at)
  where status = 'pending';

create index if not exists scheduled_tasks_user_idx
  on agentstack.scheduled_tasks (user_id, created_at desc);

alter table agentstack.scheduled_tasks enable row level security;
drop policy if exists "owners read their scheduled tasks" on agentstack.scheduled_tasks;
create policy "owners read their scheduled tasks"
  on agentstack.scheduled_tasks for select
  using (auth.uid() = user_id);

-- Cancellation also goes through the authenticated server route. Keep direct
-- browser writes closed so a signed-in client cannot mutate run times,
-- recurrence or task ownership with the publishable Supabase key.
drop policy if exists "owners may cancel their scheduled tasks" on agentstack.scheduled_tasks;
revoke insert, update, delete on agentstack.scheduled_tasks from authenticated;

grant usage on schema agentstack to authenticated, service_role;
grant all on agentstack.room_messages to service_role;
grant select, insert on agentstack.room_messages to authenticated;
grant all on agentstack.scheduled_tasks to service_role;
grant select on agentstack.scheduled_tasks to authenticated;
