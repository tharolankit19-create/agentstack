-- The clock, moved inside the database.
--
-- The heartbeat works and has always worked; what kept failing was getting
-- anything to call it. GitHub Actions needs a repository secret set by hand.
-- Vercel Cron runs once a day on Hobby, which is not a schedule a briefing can
-- live on. Both are outside the product, and both were left unconfigured, so
-- the army sat still while every part of it reported healthy.
--
-- Postgres can call a URL on a schedule by itself. pg_cron holds the schedule,
-- pg_net makes the request, and both live in the Supabase project this app
-- already requires — so the scheduler has no dependency the product did not
-- already have, and no step a founder can forget in a different console.
--
-- The bearer token is generated here rather than configured. That is the part
-- that removes the last manual step: nothing has to agree with an environment
-- variable, because the app reads the same row this scheduler signs with. Note
-- what is NOT stored here — the app's `SECRETS_ENCRYPTION_KEY`, which protects
-- customer API keys in this same database, stays in the server environment
-- where it belongs. This secret only authorises cron endpoints. Putting the
-- lock and its key in one box would be a bad trade; putting a doorbell button
-- in the box is not.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One row, enforced by the primary key: `id` can only ever be true.
create table if not exists agentstack.scheduler_config (
  id boolean primary key default true check (id),
  -- Where the app lives. The one thing an operator must set.
  app_url text,
  -- What the scheduler signs its calls with. Generated once, never rotated
  -- automatically — a rotation mid-flight would lock out the running jobs.
  secret text not null default encode(gen_random_bytes(32), 'hex'),
  -- Written on every beat, so "is the scheduler alive" is answerable from SQL
  -- alone, without waiting to see whether the app noticed.
  last_beat_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into agentstack.scheduler_config (id) values (true)
on conflict (id) do nothing;

alter table agentstack.scheduler_config enable row level security;
-- RLS on, no policies: this row holds a bearer token. Service role only.

/**
 * One beat: call the app's heartbeat with the token from the row above.
 *
 * Returns quietly when `app_url` is unset rather than raising, because this
 * runs from a cron job — an exception here would be logged where nobody looks,
 * every five minutes, forever. An unconfigured scheduler should be silent and
 * visible (`last_beat_at` stays null), not noisy and ignored.
 */
create or replace function agentstack.beat()
returns void
language plpgsql
security definer
set search_path = agentstack, extensions, net, public
as $$
declare
  cfg agentstack.scheduler_config%rowtype;
begin
  select * into cfg from agentstack.scheduler_config where id;

  if cfg.app_url is null or length(trim(cfg.app_url)) = 0 then
    return;
  end if;

  perform net.http_get(
    url := rtrim(cfg.app_url, '/') || '/api/cron/heartbeat',
    headers := jsonb_build_object('Authorization', 'Bearer ' || cfg.secret),
    -- Fire and forget. The heartbeat claims each worker's turn and dispatches
    -- it in its own invocation, so this call returns long before the work does
    -- and must never hold a database worker waiting on it.
    timeout_milliseconds := 15000
  );

  update agentstack.scheduler_config set last_beat_at = now() where id;
end;
$$;

-- Schedule it. Wrapped because a project without pg_cron privileges should get
-- a working app and a clear note, not a failed paste of the whole schema.
do $$
begin
  perform cron.unschedule('agentstack-heartbeat');
exception when others then
  null;  -- Not scheduled yet, which is the normal first-run case.
end;
$$;

do $$
begin
  perform cron.schedule('agentstack-heartbeat', '*/5 * * * *', 'select agentstack.beat()');
  raise notice 'AgentStack: internal scheduler is on, every 5 minutes.';
exception when others then
  raise warning 'AgentStack: could not schedule the heartbeat (%). Enable pg_cron under Database -> Extensions, then re-run this migration.', sqlerrm;
end;
$$;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
