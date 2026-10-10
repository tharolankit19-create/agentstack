begin;
-- Save in-flight progress without releasing the current fenced lease.
create or replace function agentstack.save_verified_job_progress(p_job uuid,p_token uuid,p_state jsonb,p_label text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions
    where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now()
      and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if jsonb_typeof(p_state) is distinct from 'object' or p_state->>'stage' not in ('discover','extract','verify','finish')
    or p_state->>'workerRunId' is null or jsonb_typeof(p_state->'billableKeys') is distinct from 'array'
    or octet_length(p_state::text)>2000000 then raise exception 'invalid pipeline progress'; end if;
  insert into agentstack.job_checkpoints(job_id,user_id,step,state,lease_token)
    values(j.id,j.user_id,'pipeline',p_state,p_token)
    on conflict(job_id,step) do update set state=excluded.state,lease_token=excluded.lease_token,created_at=now();
  insert into agentstack.job_events(job_id,user_id,event_type,label)
    values(j.id,j.user_id,'checkpoint_created',left(p_label,500));
  return true;
end $$;
revoke all on function agentstack.save_verified_job_progress(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function agentstack.save_verified_job_progress(uuid,uuid,jsonb,text) to service_role;
create or replace function agentstack.recover_verified_job(p_job uuid,p_token uuid,p_category text,p_message text,p_decision text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if p_decision not in ('retry','needs_user','fail') then raise exception 'invalid recovery decision'; end if;
  if p_decision='retry' and j.attempt>=j.max_attempts then p_decision:='fail'; end if;
  if p_decision='retry' and p_category='verification_failed' then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=1;
    update agentstack.job_checkpoints set state=(state - 'verification' - 'verifierRunId' - 'verificationSources' - 'verificationCursor') || jsonb_build_object('stage','extract','output',null,'billableKeys',coalesce(state->'discoveryKeys','[]'::jsonb)) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='retry' and p_category='source_unavailable' then
    update agentstack.job_checkpoints set state=(state - 'discoveryUrls' - 'discoveryCursor') || jsonb_build_object('stage','discover','sources','[]'::jsonb,'billableKeys','[]'::jsonb) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='fail' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=j.user_id;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'refund',j.reserved_credits,'No verified completion; reservation returned') on conflict do nothing;
  end if;
  if p_decision='fail' then update agentstack.hybrid_mission_steps set status='failed' where mission_id=j.id and status<>'completed'; end if;
  update agentstack.hybrid_missions set status=case p_decision when 'retry' then 'recovering' when 'needs_user' then 'waiting_for_user' else 'refunded' end,
    summary=left(p_message,2000),attempt=attempt+case when p_decision='retry' then 1 else 0 end,
    retry_at=case when p_decision='retry' then now()+make_interval(secs=>least(120,15*j.attempt)) else null end,
    reserved_credits=case when p_decision='fail' then 0 else reserved_credits end,
    finished_at=case when p_decision='fail' then now() else null end,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail) values(j.id,j.user_id,
    case p_decision when 'retry' then 'recovery_started' when 'needs_user' then 'approval_requested' else 'job_refunded' end,left(p_message,500),jsonb_build_object('category',p_category));
  return true;
end $$;
commit;
notify pgrst,'reload schema';
