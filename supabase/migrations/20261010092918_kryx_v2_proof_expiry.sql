begin;
create or replace function agentstack.verified_result_is_fresh(p_result jsonb,p_contract jsonb)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare verified timestamptz; maximum_age integer;
begin
  if coalesce(p_result->>'verifiedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then return false; end if;
  verified:=(p_result->>'verifiedAt')::timestamptz;
  select (p->>'value')::integer into maximum_age from jsonb_array_elements(p_contract->'predicates') p
    where p->>'kind'='URL_RESOLVES' limit 1;
  maximum_age:=coalesce(maximum_age,1800);
  return maximum_age between 1 and 86400 and verified<=now()+interval '30 seconds'
    and verified>=now()-make_interval(secs=>maximum_age);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return false;
end $$;
revoke all on function agentstack.verified_result_is_fresh(jsonb,jsonb) from public,anon,authenticated;
grant execute on function agentstack.verified_result_is_fresh(jsonb,jsonb) to service_role;
create or replace function agentstack.store_verified_job_result(p_job uuid,p_token uuid,p_worker uuid,p_verdict jsonb,p_artifacts jsonb)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; verification_id uuid; artifact jsonb; passed boolean;
begin
 select * into j from agentstack.hybrid_missions where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
 if j.id is null then raise exception 'worker lease lost'; end if;
 if p_worker=(p_verdict->>'verifierRunId')::uuid or p_worker is null or p_verdict->>'verifierRunId' is null then raise exception 'independent verifier required'; end if;
 if p_verdict->>'contractVersion' is distinct from j.completion_contract->>'version' or p_verdict->>'outputHash' !~ '^[0-9a-f]{64}$' then raise exception 'invalid verification binding'; end if;
 if jsonb_typeof(p_verdict->'passed') is distinct from 'boolean' or jsonb_typeof(p_verdict->'checks') is distinct from 'array' then raise exception 'invalid verifier result'; end if;
 passed:=(p_verdict->>'passed')::boolean;
 if passed and not agentstack.verified_result_is_fresh(p_verdict,j.completion_contract) then raise exception 'verification proof expired or timestamp invalid'; end if;
 if passed and (jsonb_array_length(p_verdict->'checks')=0 or exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'passed' is distinct from 'true')
   or exists(select 1 from jsonb_array_elements(j.completion_contract->'predicates') p where not exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'id'=p->>'id' and c->>'passed'='true'))) then raise exception 'all completion checks required'; end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' or passed and jsonb_array_length(p_artifacts)=0 then raise exception 'verified artifact required'; end if;
 for artifact in select * from jsonb_array_elements(p_artifacts) loop
  if length(coalesce(artifact->>'content',''))=0 or artifact->>'sha256' is distinct from encode(sha256(convert_to(artifact->>'content','UTF8')),'hex') then raise exception 'artifact digest mismatch'; end if;
  insert into agentstack.job_artifacts(job_id,user_id,name,media_type,content,sha256)
  values(j.id,j.user_id,artifact->>'name',artifact->>'media_type',artifact->>'content',artifact->>'sha256')
  on conflict(job_id,name) do update set content=excluded.content,sha256=excluded.sha256,media_type=excluded.media_type,created_at=now();
 end loop;
 insert into agentstack.job_verifications(job_id,user_id,worker_run_id,verifier_run_id,contract_version,output_hash,passed,result,verifier)
 values(j.id,j.user_id,p_worker,(p_verdict->>'verifierRunId')::uuid,p_verdict->>'contractVersion',p_verdict->>'outputHash',passed,p_verdict,'independent_source_reads_and_separate_model_pass') returning id into verification_id;
 update agentstack.hybrid_missions set output_hash=p_verdict->>'outputHash' where id=j.id;
 return verification_id;
end $$;
create or replace function agentstack.complete_verified_job(p_job uuid,p_token uuid,p_hash text,p_keys text[],p_receipt jsonb) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; charge integer; released integer; v agentstack.job_verifications; r jsonb;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and task_class is not null and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  select * into v from agentstack.job_verifications where job_id=j.id and passed and agentstack.verified_result_is_fresh(result,j.completion_contract) and output_hash=p_hash and contract_version=j.completion_contract->>'version' order by created_at desc limit 1;
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
create or replace function agentstack.guard_verified_job_completion() returns trigger language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  if new.task_class is not null and new.status='completed' and old.status is distinct from 'completed' then
    if not exists(select 1 from agentstack.job_verifications v where v.job_id=new.id and v.user_id=new.user_id and v.passed
      and agentstack.verified_result_is_fresh(v.result,new.completion_contract) and v.output_hash=new.output_hash and v.contract_version=new.completion_contract->>'version') then
      raise exception 'verified completion requires a passing independent verification for this output and contract';
    end if;
    if not exists(select 1 from agentstack.job_artifacts a where a.job_id=new.id and a.user_id=new.user_id) then
      raise exception 'verified completion requires an artifact';
    end if;
  end if;
  return new;
end $$;
create or replace function agentstack.checkpoint_verified_job(p_job uuid,p_token uuid,p_step text,p_state jsonb,p_label text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  insert into agentstack.job_checkpoints(job_id,user_id,step,state,lease_token) values(j.id,j.user_id,p_step,p_state,p_token)
    on conflict(job_id,step) do update set state=excluded.state,lease_token=excluded.lease_token,created_at=now();
  update agentstack.hybrid_mission_steps set status=case when p_state->>'stage'='finish' and p_state->'verification'->>'passed'='false' then 'failed' else 'completed' end,
    output=jsonb_build_object('checkpoint_step',p_step,'next_stage',p_state->>'stage'),finished_at=now()
    where mission_id=j.id and ordinal=case p_state->>'stage' when 'extract' then 0 when 'verify' then 1 when 'finish' then 2 else -1 end;
  if p_state->>'stage'='verify' and coalesce(p_state->'verification','null'::jsonb)='null'::jsonb then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=2;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'checkpoint_created',p_label);
  update agentstack.hybrid_missions set status='queued',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  return true;
end $$;
commit;
notify pgrst,'reload schema';
