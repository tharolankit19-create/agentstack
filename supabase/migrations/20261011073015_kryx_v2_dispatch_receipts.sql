-- Scheduling claims do not prove worker acceptance. Persist bounded metadata
-- on the existing service-only clock, without resetting its history.
alter table agentstack.cron_ticks
  add column if not exists last_dispatch_outcome text,
  add column if not exists last_dispatch_at timestamptz,
  add column if not exists last_dispatch_code text;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='agentstack.cron_ticks'::regclass and conname='cron_dispatch_outcome_valid') then
    alter table agentstack.cron_ticks add constraint cron_dispatch_outcome_valid
      check (last_dispatch_outcome in ('dispatching','accepted','responded','unconfirmed','failed'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='agentstack.cron_ticks'::regclass and conname='cron_dispatch_code_valid') then
    alter table agentstack.cron_ticks add constraint cron_dispatch_code_valid
      check (last_dispatch_code ~ '^(http_[1-5][0-9]{2}|timeout|network_error|missing_secret|invalid_target|invalid_response)$');
  end if;
end $$;

alter table agentstack.cron_ticks enable row level security;
revoke all on table agentstack.cron_ticks from public, anon, authenticated;
grant select,insert,update,delete on table agentstack.cron_ticks to service_role;
comment on column agentstack.cron_ticks.last_run_at is 'Worker turn claim time, not task completion or confirmed worker response.';
comment on column agentstack.cron_ticks.last_dispatch_outcome is 'Last HTTP dispatch observation. Accepted/responded never imply verified job completion.';
-- No secrets, response bodies, customer content, or raw exception text stored.
