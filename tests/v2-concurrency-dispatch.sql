-- Two separate connections see the same overdue clock. Only one may dispatch.
with claim as (
  update agentstack.cron_ticks
    set last_run_at=clock_timestamp(),last_dispatch_outcome='dispatching',last_dispatch_at=null,last_dispatch_code=null
    where worker='jobs' and last_run_at is null
    returning worker
)
insert into public.v2_fixture_clock_claims(worker) select worker from claim;
