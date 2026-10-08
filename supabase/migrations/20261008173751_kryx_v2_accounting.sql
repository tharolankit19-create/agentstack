begin;
create or replace function agentstack.start_verified_job(p_job uuid,p_user uuid,p_cap integer) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; wallet integer; free_job boolean;
begin
  select credit_balance into wallet from agentstack.profiles where id=p_user for update;
  if wallet is null then raise exception 'account unavailable'; end if;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then raise exception 'job not found'; end if;
  if j.status in ('queued','running','recovering','verifying') then return to_jsonb(j); end if;
  if j.status not in ('created','ready') then raise exception 'job cannot be started from this state'; end if;
  if p_cap < j.estimated_credits or p_cap>2000 then raise exception 'invalid hard cap'; end if;
  if (select count(*) from agentstack.hybrid_missions where user_id=p_user and task_class is not null and status in ('queued','running','recovering','verifying','waiting_for_user','waiting_for_browser')) >= 3 then raise exception 'concurrent job limit reached'; end if;
  free_job := not exists(select 1 from agentstack.hybrid_missions where user_id=p_user and is_free and status not in ('created','ready','failed','refunded','cancelled'));
  if not free_job and wallet<p_cap then raise exception 'not enough credits for the hard cap'; end if;
  if not free_job then update agentstack.profiles set credit_balance=credit_balance-p_cap where id=p_user; end if;
  update agentstack.hybrid_missions set status='queued',hard_cap=p_cap,reserved_credits=case when free_job then 0 else p_cap end,is_free=free_job,attempt=1,summary=null,updated_at=now() where id=j.id returning * into j;
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,p_user,'reserve',j.reserved_credits,case when free_job then 'First verified completion reserved for free' else 'Held until verified settlement; not a completion charge' end);
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_planned','Queued for background execution');
  return to_jsonb(j);
end $$;

create or replace function agentstack.control_verified_job(p_job uuid,p_user uuid,p_action text) returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=p_user for update;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then return false; end if;
  if j.status in ('completed','failed','refunded','cancelled') then return p_action='cancel' and j.status='cancelled'; end if;
  if p_action='cancel' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=p_user;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,p_user,'release',j.reserved_credits,'Founder cancelled; no completion charged') on conflict do nothing;
    update agentstack.hybrid_missions set status='cancelled',reserved_credits=0,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=j.id;
  elsif p_action='pause' and j.status in ('queued','running','recovering','verifying') then
    update agentstack.hybrid_missions set status='waiting_for_user',summary='Paused by you',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  elsif p_action='resume' and j.status='waiting_for_user' then
    update agentstack.hybrid_missions set status='queued',summary=null,retry_at=null,updated_at=now() where id=j.id;
  else return false;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_' || p_action,'Job ' || p_action || ' requested by you');
  return true;
end $$;

create or replace function agentstack.begin_job_operation(p_job uuid,p_token uuid,p_key text,p_run uuid,p_service text,p_model text,p_credits integer)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; spent integer; operation_id uuid;
begin
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  if p_credits<0 then raise exception 'invalid work units'; end if;
  select id into operation_id from agentstack.job_usage where job_id=p_job and operation_key=p_key;
  if operation_id is not null then raise exception 'operation already reserved'; end if;
  select coalesce(sum(credits),0) into spent from agentstack.job_usage where job_id=p_job;
  if spent+p_credits>j.hard_cap then raise exception 'credit_cap'; end if;
  insert into agentstack.job_usage(job_id,user_id,operation_key,run_id,service,model,credits,outcome) values(p_job,j.user_id,p_key,p_run,p_service,p_model,p_credits,'started') returning id into operation_id;
  return operation_id;
end $$;
create or replace function agentstack.finish_job_operation(p_job uuid,p_token uuid,p_operation uuid,p_ok boolean,p_latency integer,p_input integer,p_output integer,p_cost numeric,p_error text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  perform 1 from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if not found then return false; end if;
  update agentstack.job_usage set outcome=case when p_ok then 'succeeded' else 'failed' end,latency_ms=p_latency,input_tokens=p_input,output_tokens=p_output,provider_cost_usd=p_cost,error_code=p_error where id=p_operation and job_id=p_job and outcome='started';
  return found;
end $$;

create or replace function agentstack.complete_verified_job(p_job uuid,p_token uuid,p_hash text,p_keys text[],p_receipt jsonb) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; charge integer; released integer; v agentstack.job_verifications; r jsonb;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and task_class is not null and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  select * into v from agentstack.job_verifications where job_id=j.id and passed and output_hash=p_hash and contract_version=j.completion_contract->>'version' order by created_at desc limit 1;
  if v.id is null or v.worker_run_id=v.verifier_run_id then raise exception 'verification required'; end if;
  if exists(select 1 from unnest(p_keys) k where not exists(select 1 from agentstack.job_usage u where u.job_id=j.id and u.operation_key=k and u.outcome='succeeded')) then raise exception 'billable operation missing or unsuccessful'; end if;
  select coalesce(sum(credits),0) into charge from agentstack.job_usage where job_id=j.id and operation_key=any(p_keys) and outcome='succeeded';
  if j.is_free then charge:=0; end if;
  if charge>j.hard_cap or charge>j.reserved_credits and not j.is_free then raise exception 'credit cap exceeded'; end if;
  released:=j.reserved_credits-charge;
  update agentstack.profiles set credit_balance=credit_balance+released,credits_spent=credits_spent+charge where id=j.user_id;
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,case when j.is_free then 'free_completion' else 'settle' end,charge,'Independent verification passed');
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'release',released,'Unused reservation returned; internal failed attempts not billed');
  r:=p_receipt || jsonb_build_object('creditsUsed',charge,'releasedCredits',released,'failedAttemptsCharged',0,'elapsedSeconds',greatest(0,extract(epoch from now()-j.started_at)::integer));
  update agentstack.hybrid_missions set status='completed',output_hash=p_hash,receipt=r,credits_used=charge,reserved_credits=0,summary=r->>'result',finished_at=now(),updated_at=now(),lease_token=null,lease_expires_at=null where id=j.id;
  update agentstack.hybrid_mission_steps set status='completed',finished_at=coalesce(finished_at,now()) where mission_id=j.id;
  insert into agentstack.job_messages(job_id,user_id,role,content) values(j.id,j.user_id,'assistant',r->>'result');
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'verification_passed','Independent completion checks passed'),(j.id,j.user_id,'job_completed',r->>'result');
  return r;
end $$;
do $$ declare signature text; begin
 foreach signature in array array['start_verified_job(uuid,uuid,integer)','control_verified_job(uuid,uuid,text)','begin_job_operation(uuid,uuid,text,uuid,text,text,integer)','finish_job_operation(uuid,uuid,uuid,boolean,integer,integer,integer,numeric,text)','complete_verified_job(uuid,uuid,text,text[],jsonb)'] loop
  execute 'revoke all on function agentstack.' || signature || ' from public,anon,authenticated';
  execute 'grant execute on function agentstack.' || signature || ' to service_role';
 end loop;
end $$;
commit;
notify pgrst,'reload schema';
