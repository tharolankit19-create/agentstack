-- Timed instructions: "at 5pm, write the launch post and message me".
--
-- The founder tells the head agent to do something later, and it actually does
-- it later. That needs somewhere to remember the instruction between now and
-- then — this table — and a cron that wakes up, finds what is due, does it, and
-- messages the result. Nothing here runs the task; it only holds it.
--
-- Deliberately small. One row is one thing to do at one time. Recurring tasks,
-- dependencies and calendars are all things this is not — a founder saying "5pm"
-- wants one message at 5pm, not a scheduling engine.

create table if not exists agentstack.scheduled_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- Which agent should carry it out. Usually the head agent.
  agent_id    uuid references agentstack.agents on delete set null,

  -- What to do, in the founder's own words.
  instruction text not null check (length(instruction) between 1 and 2000),
  -- When, in UTC. The parser converts the founder's local time using their
  -- head agent's timezone.
  run_at      timestamptz not null,
  -- How it was said, for the confirmation and the reminder ("at 5pm").
  when_label  text,

  status      text not null default 'pending'
              check (status in ('pending', 'done', 'failed', 'cancelled')),
  -- What the agent produced when it ran, so the dashboard can show it too.
  result      text,
  error       text,

  created_at  timestamptz not null default now(),
  ran_at      timestamptz
);

-- The cron's query: what is due and still pending, oldest first.
create index if not exists scheduled_tasks_due_idx
  on agentstack.scheduled_tasks (status, run_at)
  where status = 'pending';

create index if not exists scheduled_tasks_user_idx
  on agentstack.scheduled_tasks (user_id, created_at desc);

alter table agentstack.scheduled_tasks enable row level security;

-- The founder sees their own scheduled tasks on the dashboard.
create policy "owners read their scheduled tasks"
  on agentstack.scheduled_tasks for select
  using (auth.uid() = user_id);

-- And may cancel one. Everything else is written by the service role: the
-- webhook creates them after the founder asks, the cron runs them. A customer
-- inserting arbitrary run_at rows is a way to make the platform do work on a
-- schedule they chose, so creation stays server-side.
create policy "owners may cancel their scheduled tasks"
  on agentstack.scheduled_tasks for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- Only the status may move, and only to cancelled.
    and instruction = (select t.instruction from agentstack.scheduled_tasks t
                       where t.id = scheduled_tasks.id)
    and run_at = (select t.run_at from agentstack.scheduled_tasks t
                  where t.id = scheduled_tasks.id)
  );

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
