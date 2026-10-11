do $$ declare j agentstack.hybrid_missions; wallet integer; releases integer; released integer;
begin
  select * into j from agentstack.hybrid_missions where id=(select id from public.v2_fixture_job);
  select credit_balance into wallet from agentstack.profiles where id=j.user_id;
  select count(*),sum(credits) into releases,released from agentstack.job_ledger where job_id=j.id and kind='release';
  if j.status<>'cancelled' or j.reserved_credits<>0 or wallet<>500 or releases<>1 or released<>120 then
    raise exception 'Concurrent cancellation failed to release exactly once';
  end if;
end $$;
