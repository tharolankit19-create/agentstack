
\set ON_ERROR_STOP on
do $$ begin
 if (select credit_balance from agentstack.profiles where id='00000000-0000-0000-0000-000000000002')<>300 then raise exception 'Duplicate or missing reward'; end if;
 if (select count(*) from agentstack.feedback_rewards)<>1 then raise exception 'Duplicate ledger'; end if;
 if (select count(*) from agentstack.credit_topups where paid_cents=0 and provider='feedback')<>1 then raise exception 'Invalid topup'; end if;
 if (select status from agentstack.feedback_sessions where id='10000000-0000-0000-0000-000000000002')<>'rewarded' then raise exception 'Missing decision'; end if;
end $$;
