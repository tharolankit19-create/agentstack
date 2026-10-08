-- Promote existing hybrid missions to Jobs. Legacy rows have task_class=NULL.
-- No user, balance, history, agent, device, or billing row is deleted/reset.
begin;
alter table agentstack.hybrid_missions drop constraint if exists hybrid_missions_status_check;
alter table agentstack.hybrid_missions add constraint hybrid_missions_status_check check (status in (
  'created','planning','ready','queued','running','waiting_for_browser','waiting_for_device','waiting_for_user',
  'blocked','recovering','verifying','completed','failed','refunded','cancelled'
));
alter table agentstack.hybrid_missions
  add column if not exists task_class text check(task_class in ('LEAD_LIST','RESEARCH_BRIEF','COMPETITOR_SCAN','OUTREACH_DRAFTS','CONTENT_REPURPOSE')),
  add column if not exists completion_contract jsonb,
  add column if not exists estimate_min integer,
  add column if not exists hard_cap integer check(hard_cap between 1 and 2000),
  add column if not exists reserved_credits integer not null default 0 check(reserved_credits >= 0),
  add column if not exists is_free boolean not null default false,
  add column if not exists receipt jsonb,
  add column if not exists output_hash text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt integer not null default 0,
  add column if not exists max_attempts integer not null default 3 check(max_attempts between 1 and 5),
  add column if not exists retry_at timestamptz,
  add column if not exists next_run_at timestamptz,
  add column if not exists request_key uuid;
create unique index if not exists hybrid_missions_owner_key on agentstack.hybrid_missions(id,user_id);
create unique index if not exists jobs_request_key on agentstack.hybrid_missions(user_id,request_key) where request_key is not null;
create index if not exists jobs_queue on agentstack.hybrid_missions(status,retry_at,created_at) where task_class is not null;
alter table agentstack.hybrid_mission_steps add column if not exists attempt integer not null default 0;

create table if not exists agentstack.job_messages (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 20000),
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_events (
  id bigint generated always as identity primary key, job_id uuid not null, user_id uuid not null,
  event_type text not null, label text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_artifacts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  name text not null check(name ~ '^[a-zA-Z0-9_.-]{1,120}$'), media_type text not null,
  content text not null check(length(content) <= 2000000), sha256 text not null,
  created_at timestamptz not null default now(), unique(job_id,name),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_verifications (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  worker_run_id uuid not null, verifier_run_id uuid not null check(worker_run_id <> verifier_run_id),
  contract_version text not null, output_hash text not null, passed boolean not null,
  result jsonb not null, verifier text not null, created_at timestamptz not null default now(),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_checkpoints (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  step text not null, state jsonb not null, lease_token uuid not null,
  created_at timestamptz not null default now(), unique(job_id,step),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_usage (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  operation_key text not null, run_id uuid not null, service text not null, model text,
  credits integer not null check(credits >= 0), input_tokens integer, output_tokens integer,
  provider_cost_usd numeric check(provider_cost_usd >= 0), outcome text not null check(outcome in ('started','succeeded','failed')),
  latency_ms integer, error_code text, created_at timestamptz not null default now(), unique(job_id,operation_key),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_ledger (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  kind text not null check(kind in ('reserve','settle','release','refund','free_completion')),
  credits integer not null check(credits >= 0), reason text not null,
  created_at timestamptz not null default now(), unique(job_id,kind),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.reliability_ledger (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  task_class text not null, domain text, tool text not null, action text not null, method text not null,
  expected_state text, observed_state text, success boolean not null, failure_category text,
  latency_ms integer not null, attempt integer not null, verification_passed boolean, cost_credits integer not null default 0,
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);

do $$ declare t text; begin
  foreach t in array array['job_messages','job_events','job_artifacts','job_verifications','job_checkpoints','job_usage','job_ledger','reliability_ledger'] loop
    execute format('alter table agentstack.%I enable row level security',t);
    execute format('revoke all on agentstack.%I from public,anon,authenticated',t);
    execute format('grant select on agentstack.%I to authenticated',t);
    execute format('grant all on agentstack.%I to service_role',t);
    execute format('drop policy if exists owner_read on agentstack.%I',t);
    execute format('create policy owner_read on agentstack.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('create index if not exists %I on agentstack.%I(job_id,created_at)',t || '_job_time',t);
  end loop;
end $$;
grant usage,select on sequence agentstack.job_events_id_seq to service_role;

-- Only the server verifier may authorize verified completion; legacy missions remain readable.
create or replace function agentstack.guard_verified_job_completion() returns trigger language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  if new.task_class is not null and new.status='completed' and old.status is distinct from 'completed' then
    if not exists(select 1 from agentstack.job_verifications v where v.job_id=new.id and v.user_id=new.user_id and v.passed
      and v.output_hash=new.output_hash and v.contract_version=new.completion_contract->>'version') then
      raise exception 'verified completion requires a passing independent verification for this output and contract';
    end if;
    if not exists(select 1 from agentstack.job_artifacts a where a.job_id=new.id and a.user_id=new.user_id) then
      raise exception 'verified completion requires an artifact';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_verified_job_completion on agentstack.hybrid_missions;
create trigger guard_verified_job_completion before update on agentstack.hybrid_missions for each row execute function agentstack.guard_verified_job_completion();
revoke all on function agentstack.guard_verified_job_completion() from public,anon,authenticated;

create or replace function agentstack.create_verified_job(p_user_id uuid,p_goal text,p_contract jsonb,p_min integer,p_max integer,p_cap integer,p_key uuid)
returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  if p_cap < p_max or p_min < 0 or p_max < 1 or p_key is null or p_contract->>'version' is null then raise exception 'invalid job contract/budget'; end if;
  insert into agentstack.hybrid_missions(user_id,instruction,task_class,completion_contract,estimate_min,estimated_credits,hard_cap,request_key,status,requested_execution)
  values(p_user_id,p_goal,p_contract->>'taskClass',p_contract,p_min,p_max,p_cap,p_key,'created','cloud')
  on conflict(user_id,request_key) where request_key is not null do nothing returning * into j;
  if j.id is null then select * into j from agentstack.hybrid_missions where user_id=p_user_id and request_key=p_key; return to_jsonb(j); end if;
  insert into agentstack.job_messages(job_id,user_id,role,content) values(j.id,p_user_id,'user',p_goal);
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user_id,'job_created','Completion criteria are ready for review');
  return to_jsonb(j);
end $$;
revoke all on function agentstack.create_verified_job(uuid,text,jsonb,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function agentstack.create_verified_job(uuid,text,jsonb,integer,integer,integer,uuid) to service_role;
commit;
notify pgrst,'reload schema';
