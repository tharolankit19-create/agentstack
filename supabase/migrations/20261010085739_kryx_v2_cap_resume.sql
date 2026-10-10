begin;
alter table agentstack.hybrid_missions add column if not exists blocker_category text;
alter table agentstack.job_ledger add column if not exists detail jsonb not null default '{}';
alter table agentstack.job_ledger drop constraint if exists job_ledger_kind_check;
alter table agentstack.job_ledger add constraint job_ledger_kind_check
  check(kind in ('reserve','reserve_increase','settle','release','refund','free_completion'));
-- Initial/terminal entries remain unique; each explicit cap increase gets its own immutable entry.
alter table agentstack.job_ledger drop constraint if exists job_ledger_job_id_kind_key;
create unique index if not exists job_ledger_single_kind on agentstack.job_ledger(job_id,kind)
  where kind<>'reserve_increase';

update agentstack.hybrid_missions j set blocker_category=coalesce(
  (select e.detail->>'category' from agentstack.job_events e where e.job_id=j.id and e.event_type='approval_requested' order by e.created_at desc,e.id desc limit 1),
  case when j.summary='Paused by you' then 'paused_by_user' end)
  where j.task_class is not null and j.status='waiting_for_user' and j.blocker_category is null;

create or replace function agentstack.resume_verified_job(p_job uuid,p_user uuid,p_cap integer)
returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; wallet integer; target_cap integer; increase integer; held integer;
begin
  select credit_balance into wallet from agentstack.profiles where id=p_user for update;
  if wallet is null then raise exception 'account unavailable'; end if;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then raise exception 'job not found'; end if;
  target_cap:=coalesce(p_cap,j.hard_cap);
  if j.status in ('queued','running','recovering','verifying') and target_cap=j.hard_cap then return to_jsonb(j); end if;
  if j.status<>'waiting_for_user' then raise exception 'job must be paused before adjusting its cap'; end if;
  if target_cap<j.hard_cap or target_cap<j.estimated_credits or target_cap>2000 then raise exception 'invalid hard cap'; end if;
  if j.blocker_category='credit_cap' and target_cap<=j.hard_cap then raise exception 'higher cap required'; end if;
  increase:=target_cap-j.hard_cap;
  held:=case when j.is_free then 0 else increase end;
  if wallet<held then raise exception 'not enough credits for the increased cap'; end if;
  if increase>0 then
    update agentstack.profiles set credit_balance=credit_balance-held where id=p_user;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason,detail)
      values(j.id,p_user,'reserve_increase',held,'Founder explicitly increased the hard cap',
        jsonb_build_object('previousCap',j.hard_cap,'newCap',target_cap,'internalBudgetIncrease',increase));
  end if;
  update agentstack.hybrid_missions set status='queued',hard_cap=target_cap,reserved_credits=reserved_credits+held,
    blocker_category=null,summary=null,retry_at=null,lease_token=null,lease_expires_at=null,updated_at=now()
    where id=j.id returning * into j;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail)
    values(j.id,p_user,'job_resume','Resumed by you',jsonb_build_object('hardCap',target_cap,'additionalReservation',held));
  return to_jsonb(j);
end $$;
revoke all on function agentstack.resume_verified_job(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function agentstack.resume_verified_job(uuid,uuid,integer) to service_role;
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
    update agentstack.hybrid_missions set status='cancelled',blocker_category=null,reserved_credits=0,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=j.id;
  elsif p_action='pause' and j.status in ('queued','running','recovering','verifying') then
    update agentstack.hybrid_missions set status='waiting_for_user',blocker_category='paused_by_user',summary='Paused by you',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  elsif p_action='resume' and j.status='waiting_for_user' then
    update agentstack.hybrid_missions set status='queued',blocker_category=null,summary=null,retry_at=null,updated_at=now() where id=j.id;
  else return false;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_' || p_action,'Job ' || p_action || ' requested by you');
  return true;
end $$;
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
    blocker_category=case when p_decision='needs_user' then p_category else null end,
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
