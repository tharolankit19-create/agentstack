do $$ declare j agentstack.hybrid_missions; wallet integer; increases integer;
begin
  select * into j from agentstack.hybrid_missions where id=(select id from public.v2_fixture_job);
  select credit_balance into wallet from agentstack.profiles where id=j.user_id;
  select count(*) into increases from agentstack.job_ledger where job_id=j.id and kind='reserve_increase';
  if j.hard_cap<>120 or j.reserved_credits<>120 or wallet<>380 or increases<>1 then
    raise exception 'Concurrent resume duplicated or lost the cap reservation: cap %, held %, wallet %, entries %',j.hard_cap,j.reserved_credits,wallet,increases;
  end if;
end $$;
