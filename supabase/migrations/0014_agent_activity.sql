-- Live activity: which agent is working right now.
--
-- The dashboard wants to show the founder their army in motion — "the research
-- agent is digging, the writer is drafting, the head agent is holding it all
-- together" — not a static roster. That needs a place to record work as it
-- starts, because the work itself is a fast server call that leaves no trace by
-- the time a dashboard poll arrives.
--
-- So each time an agent begins something, it drops a short-lived marker here
-- with a human label and an expiry a minute or two out. The dashboard reads the
-- unexpired ones and lights up exactly those agents, by name. Rows are tiny and
-- self-cleaning: anything past its expiry is ignored and periodically deleted.

create table if not exists agentstack.agent_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- The deployed agent, when there is one. Null for a squad role the head agent
  -- is orchestrating that the founder has not separately deployed.
  agent_id    uuid references agentstack.agents on delete set null,
  -- Always set — it is how the UI resolves the name and face.
  template_id text not null,
  -- What it is doing, in the founder's words: "digging up the latest for you".
  label       text not null check (length(label) between 1 and 200),
  started_at  timestamptz not null default now(),
  -- The dashboard shows this row only while now() < expires_at.
  expires_at  timestamptz not null
);

-- The dashboard's query: this founder's markers that are still live.
create index if not exists agent_activity_live_idx
  on agentstack.agent_activity (user_id, expires_at desc);

alter table agentstack.agent_activity enable row level security;

-- The founder sees their own army working. Everything is written by the service
-- role from inside the chat and cron paths — a customer inserting activity rows
-- would just be lighting up fake work on their own dashboard, so writes stay
-- server-side.
create policy "owners read their agent activity"
  on agentstack.agent_activity for select
  using (auth.uid() = user_id);

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
