-- The clock the army runs on.
--
-- Every scheduled promise in this product — the morning briefing, the research
-- pulse, "at 5pm do X", the squads doing today's job — is an endpoint that does
-- its work correctly and waits to be called. This table is what makes calling
-- them reliable: one row per worker, holding the last time it took its turn.
--
-- Keeping the schedule in the database rather than in the caller is what lets
-- the heartbeat be dumb. An outside scheduler only has to hit one URL often;
-- which workers are actually due is decided here, against real timestamps. If
-- the heartbeat is late, or missed a night entirely, the next tick still finds
-- everything overdue and runs it — where a wall-clock schedule would skip the
-- slot and wait for tomorrow.

create table if not exists agentstack.cron_ticks (
  worker text primary key,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The five workers, seeded so the first heartbeat after deploy has rows to
-- claim. `last_run_at` null means "overdue" — so everything runs on the very
-- first tick, and the army starts working the moment the schedule is wired up
-- rather than one full interval later.
insert into agentstack.cron_ticks (worker, last_run_at)
values
  ('tasks', null),
  ('agents', null),
  ('briefing', null),
  ('research', null),
  ('playbook', null)
on conflict (worker) do nothing;

alter table agentstack.cron_ticks enable row level security;

-- RLS on, no policies, on purpose. This table is scheduling machinery, not
-- customer data: nobody signed in has any reason to read it, and anyone able to
-- write it could stall every founder's briefing by dating a tick into the
-- future. Service role only, which is what the heartbeat route uses.

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
