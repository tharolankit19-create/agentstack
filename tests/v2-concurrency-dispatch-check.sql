do $$ begin
  if (select count(*) from public.v2_fixture_clock_claims)<>1 then
    raise exception 'Concurrent heartbeats did not claim exactly one dispatch';
  end if;
  if not exists(select 1 from agentstack.cron_ticks where worker='jobs' and last_run_at is not null and last_dispatch_outcome='dispatching') then
    raise exception 'Dispatch observation missing after claim';
  end if;
end $$;
