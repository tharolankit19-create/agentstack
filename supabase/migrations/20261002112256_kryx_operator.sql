-- Additive operator schema. Existing agents, billing and customer state are untouched.
create table agentstack.kryx_goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references agentstack.profiles(id), objective text not null,
 status text not null default 'PLANNING' check(status in ('PLANNING','READY','RUNNING','WAITING','WAITING_FOR_APPROVAL','PAUSED','COMPLETED','FAILED','CANCELLED')),
 context jsonb not null default '{}', plan jsonb, budget integer not null default 100 check(budget between 0 and 100000), spent integer not null default 0,
 idempotency_key text not null, created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz, error text,
 unique(id,user_id),unique(user_id,idempotency_key)
);
create table agentstack.kryx_tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,key text not null,title text not null,objective text not null,operation text not null,
 inputs jsonb not null default '{}',output jsonb not null default '{}',status text not null default 'WAITING' check(status in ('PLANNING','READY','RUNNING','WAITING','WAITING_FOR_APPROVAL','PAUSED','COMPLETED','FAILED','CANCELLED')),
 priority integer not null default 0,progress integer not null default 0 check(progress between 0 and 100),assigned_worker text,approval_state text not null default 'NONE',
 retry_count integer not null default 0,max_retries integer not null default 3,timeout_seconds integer not null default 180,available_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,last_heartbeat timestamptz,error text,created_at timestamptz not null default now(),started_at timestamptz,completed_at timestamptz,
 unique(id,user_id),unique(goal_id,key),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id)
);
create index kryx_task_queue on agentstack.kryx_tasks(status,available_at,priority desc);
create table agentstack.kryx_task_dependencies(user_id uuid not null,task_id uuid not null,depends_on uuid not null,primary key(task_id,depends_on),check(task_id<>depends_on),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id),foreign key(depends_on,user_id) references agentstack.kryx_tasks(id,user_id));
create table agentstack.kryx_task_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null,task_id uuid not null,lease_token uuid not null,status text not null default 'RUNNING',started_at timestamptz not null default now(),completed_at timestamptz,error text,foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id));
create table agentstack.kryx_task_steps(id uuid primary key default gen_random_uuid(),user_id uuid not null,task_id uuid not null,idempotency_key text not null,status text not null,last_error text,retry_count integer not null default 0,timeout_seconds integer not null default 60,last_heartbeat timestamptz,unique(task_id,idempotency_key),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id));
create table agentstack.kryx_task_events(id bigint generated always as identity primary key,user_id uuid not null,goal_id uuid not null,task_id uuid,type text not null,data jsonb not null default '{}',created_at timestamptz not null default now(),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id));
create index kryx_event_trace on agentstack.kryx_task_events(user_id,goal_id,id);
create table agentstack.kryx_artifacts(id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,task_id uuid not null,name text not null,type text not null,content text not null,mime text,version integer not null default 1,sources jsonb not null default '[]',status text not null default 'READY',created_at timestamptz not null default now(),unique(task_id,name,version),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id));
create table agentstack.kryx_approvals(id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,task_id uuid not null,action text not null,risk text not null,payload jsonb not null,fingerprint text not null,status text not null default 'PENDING' check(status in('PENDING','APPROVED','DENIED','EXECUTING','EXECUTED','UNKNOWN','EXPIRED')),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'),executed_at timestamptz,provider_id text,error text,unique(task_id,fingerprint),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id));
create table agentstack.kryx_approval_rules(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),action text not null,decision text not null check(decision in('ALLOW','ASK','DENY')),created_at timestamptz not null default now(),unique(user_id,action));
create table agentstack.kryx_memories(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),scope text not null default 'workspace',type text not null check(type in('PROFILE','BUSINESS','AUDIENCE','STYLE','PROJECT','PROCEDURAL','EPISODIC','COMPETITOR','FACT')),key text not null,value jsonb not null,source jsonb not null default '{}',confidence numeric not null default .5 check(confidence between 0 and 1),times_confirmed integer not null default 1,created_at timestamptz not null default now(),last_verified_at timestamptz not null default now(),unique(user_id,scope,type,key));
create table agentstack.kryx_skills(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),name text not null,description text not null,instructions jsonb not null,inputs_schema jsonb not null default '{}',required_tools jsonb not null default '[]',approval_rules jsonb not null default '{}',validation_steps jsonb not null default '[]',failure_policy text not null default 'PAUSE',version integer not null default 1,success_count integer not null default 0,failure_count integer not null default 0,created_by text not null default 'user',source jsonb not null default '{}',state text not null default 'DRAFT' check(state in('DRAFT','TESTED','ENABLED')),created_at timestamptz not null default now());
create table agentstack.kryx_routines(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),name text not null,objective text not null,context jsonb not null default '{}',schedule jsonb not null,timezone text not null,enabled boolean not null default true,approval_policy jsonb not null default '{"external":"ASK"}',last_run timestamptz,next_run timestamptz not null,lease_until timestamptz,created_at timestamptz not null default now());
create index kryx_routine_due on agentstack.kryx_routines(next_run) where enabled;
create table agentstack.kryx_computer_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),goal_id uuid,session_key text not null,status text not null default 'ACTIVE',screenshot text,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '1 hour'),unique(user_id,session_key),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id));
create table agentstack.kryx_tool_runs(id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,task_id uuid not null,idempotency_key text not null,action text not null,provider text not null,status text not null default 'RUNNING',input jsonb not null,output jsonb,credits integer not null default 0,usage jsonb not null default '{}',error text,created_at timestamptz not null default now(),completed_at timestamptz,unique(task_id,idempotency_key),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id));
create table agentstack.kryx_trigger_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),provider text not null,event_key text not null,payload jsonb not null,status text not null default 'QUEUED',created_at timestamptz not null default now(),unique(user_id,provider,event_key));

create table agentstack.kryx_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,task_id uuid not null,text text not null,status text not null default 'QUEUED',created_at timestamptz not null default now(),started_at timestamptz,unique(task_id),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id));
create table agentstack.kryx_email_suppressions(id uuid primary key default gen_random_uuid(),user_id uuid not null references agentstack.profiles(id),email text not null,reason text not null,source_email_id text,created_at timestamptz not null default now(),unique(user_id,email));

create function agentstack.kryx_email_event(p_user uuid,p_event text,p_provider_id text,p_type text) returns boolean language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_approvals;e uuid;begin
 select * into a from agentstack.kryx_approvals where user_id=p_user and provider_id=p_provider_id;
 if a.id is null then return false;end if;
 insert into agentstack.kryx_trigger_events(user_id,provider,event_key,payload,status) values(p_user,'resend',p_event,jsonb_build_object('provider_id',p_provider_id,'type',p_type),'PROCESSED') on conflict(user_id,provider,event_key) do nothing returning id into e;
 if e is null then return true;end if;
 if p_type in('email.bounced','email.complained') then
 insert into agentstack.kryx_email_suppressions(user_id,email,reason,source_email_id) values(p_user,lower(a.payload->>'to'),p_type,p_provider_id) on conflict(user_id,email) do update set reason=excluded.reason;
 update agentstack.kryx_approvals set error=p_type where id=a.id;end if;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(p_user,a.goal_id,a.task_id,p_type,jsonb_build_object('approval_id',a.id,'provider_id',p_provider_id));return true;end $$;

create function agentstack.kryx_edit_plan(p_user uuid,p_goal uuid,p_plan jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare g agentstack.kryx_goals;s jsonb;d text;prefix text;begin
 select * into g from agentstack.kryx_goals where id=p_goal and user_id=p_user and status='READY' for update;if g.id is null then raise exception 'Only a ready plan can be edited';end if;
 prefix='revision_'||replace(gen_random_uuid()::text,'-','')||'_';
 update agentstack.kryx_tasks set status='CANCELLED' where goal_id=g.id and operation<>'plan';
 for s in select value from jsonb_array_elements(p_plan->'steps') loop
 insert into agentstack.kryx_tasks(user_id,goal_id,key,title,objective,operation,inputs,assigned_worker) values(p_user,g.id,prefix||(s->>'key'),s->>'title',s->>'objective',s->>'operation',coalesce(s->'inputs','{}')||jsonb_build_object('_plan_key',s->>'key'),s->>'operation');end loop;
 for s in select value from jsonb_array_elements(p_plan->'steps') loop for d in select jsonb_array_elements_text(s->'depends_on') loop
 insert into agentstack.kryx_task_dependencies(user_id,task_id,depends_on) select p_user,a.id,b.id from agentstack.kryx_tasks a,agentstack.kryx_tasks b where a.goal_id=g.id and b.goal_id=g.id and a.key=prefix||(s->>'key') and b.key=prefix||d;end loop;end loop;
 update agentstack.kryx_goals set plan=p_plan where id=g.id;
 insert into agentstack.kryx_task_events(user_id,goal_id,type,data) values(p_user,g.id,'plan.edited',jsonb_build_object('before',g.plan,'after',p_plan));end $$;

create function agentstack.kryx_create_goal(p_user uuid,p_objective text,p_context jsonb,p_budget integer,p_key text) returns uuid language plpgsql security invoker set search_path='' as $$
declare g uuid;begin
 insert into agentstack.kryx_goals(user_id,objective,context,budget,idempotency_key) values(p_user,p_objective,p_context,p_budget,p_key) on conflict(user_id,idempotency_key) do nothing returning id into g;
 if g is null then select id into g from agentstack.kryx_goals where user_id=p_user and idempotency_key=p_key;return g;end if;
 insert into agentstack.kryx_tasks(user_id,goal_id,key,title,objective,operation,status,assigned_worker) values(p_user,g,'plan','Create plan',p_objective,'plan','READY','Kryx');
 insert into agentstack.kryx_task_events(user_id,goal_id,type,data) values(p_user,g,'goal.created',jsonb_build_object('objective',p_objective));
 if p_context ? 'routine_id' then insert into agentstack.kryx_task_events(user_id,goal_id,type,data) values(p_user,g,'routine.fired',jsonb_build_object('routine_id',p_context->>'routine_id'));end if;
 return g;end $$;

create function agentstack.kryx_claim_task() returns jsonb language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;begin
 select x.* into t from agentstack.kryx_tasks x join agentstack.kryx_goals g on g.id=x.goal_id where g.status in('PLANNING','RUNNING') and (select count(*) from agentstack.kryx_tasks busy where busy.user_id=x.user_id and busy.status='RUNNING' and busy.lease_until>now())<2 and x.retry_count<x.max_retries and x.available_at<=now() and (x.status in('READY','WAITING') or (x.status='RUNNING' and x.lease_until<now())) and not exists(select 1 from agentstack.kryx_task_dependencies d join agentstack.kryx_tasks dep on dep.id=d.depends_on where d.task_id=x.id and dep.status<>'COMPLETED') order by x.priority desc,x.created_at for update of x skip locked limit 1;
 if t.id is null then return null;end if;
 -- Serialize capacity accounting per account, so simultaneous dispatchers cannot exceed two workers.
 perform 1 from agentstack.profiles where id=t.user_id for update;
 if (select count(*) from agentstack.kryx_tasks where user_id=t.user_id and status='RUNNING' and lease_until>now())>=2 then return null;end if;
 update agentstack.kryx_task_runs set status='ABANDONED',completed_at=now() where task_id=t.id and status='RUNNING';
 update agentstack.kryx_tasks set status='RUNNING',lease_token=gen_random_uuid(),lease_until=now()+interval '4 minutes',last_heartbeat=now(),retry_count=retry_count+1,started_at=coalesce(started_at,now()),error=null where id=t.id returning * into t;
 insert into agentstack.kryx_task_runs(user_id,task_id,lease_token) values(t.user_id,t.id,t.lease_token);
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'task.started',jsonb_build_object('title',t.title,'attempt',t.retry_count));return to_jsonb(t);end $$;

create function agentstack.kryx_heartbeat(p_task uuid,p_token uuid) returns boolean language sql security invoker set search_path='' as $$
 with changed as(update agentstack.kryx_tasks set lease_until=now()+interval '4 minutes',last_heartbeat=now() where id=p_task and lease_token=p_token and status='RUNNING' and lease_until>now() returning id) select exists(select 1 from changed) $$;

create function agentstack.kryx_save_plan(p_task uuid,p_token uuid,p_plan jsonb,p_context jsonb default '{}') returns void language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;s jsonb;d text;begin
 select * into t from agentstack.kryx_tasks where id=p_task and lease_token=p_token and status='RUNNING' and lease_until>now() for update;if t.id is null then raise exception 'Lease lost';end if;
 perform 1 from agentstack.kryx_goals where id=t.goal_id and status='PLANNING' for update;if not found then raise exception 'Goal is not planning';end if;
 for s in select value from jsonb_array_elements(p_plan->'steps') loop
 insert into agentstack.kryx_tasks(user_id,goal_id,key,title,objective,operation,inputs,assigned_worker) values(t.user_id,t.goal_id,s->>'key',s->>'title',s->>'objective',s->>'operation',coalesce(s->'inputs','{}'),s->>'operation');end loop;
 for s in select value from jsonb_array_elements(p_plan->'steps') loop for d in select jsonb_array_elements_text(s->'depends_on') loop
 insert into agentstack.kryx_task_dependencies(user_id,task_id,depends_on) select t.user_id,a.id,b.id from agentstack.kryx_tasks a,agentstack.kryx_tasks b where a.goal_id=t.goal_id and b.goal_id=t.goal_id and a.key=s->>'key' and b.key=d;end loop;end loop;
 update agentstack.kryx_goals set plan=p_plan,context=context||p_context,status=case when context ? 'routine_id' then 'RUNNING' else 'READY' end where id=t.goal_id;
 update agentstack.kryx_tasks set status='COMPLETED',progress=100,completed_at=now(),lease_until=null where id=t.id;
 update agentstack.kryx_task_runs set status='COMPLETED',completed_at=now() where task_id=t.id and lease_token=p_token;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'plan.created',p_plan);end $$;

create function agentstack.kryx_control(p_user uuid,p_goal uuid,p_action text) returns void language plpgsql security invoker set search_path='' as $$
declare g agentstack.kryx_goals;begin select * into g from agentstack.kryx_goals where id=p_goal and user_id=p_user for update;if g.id is null then raise exception 'Goal not found';end if;
 if p_action in('start','resume') and g.status in('READY','PAUSED','FAILED') then
 update agentstack.kryx_goals set status=case when plan is null then 'PLANNING' else 'RUNNING' end,error=null,started_at=coalesce(started_at,now()) where id=g.id;
 update agentstack.kryx_tasks set status='WAITING',retry_count=0,available_at=now(),lease_token=null,lease_until=null where goal_id=g.id and status in('FAILED','PAUSED');
 elsif p_action in('pause','cancel') and g.status not in('COMPLETED','CANCELLED') then
 update agentstack.kryx_goals set status=case when p_action='pause' then 'PAUSED' else 'CANCELLED' end where id=g.id;
 update agentstack.kryx_tasks set status=case when p_action='pause' then 'PAUSED' else 'CANCELLED' end,lease_token=null,lease_until=null where goal_id=g.id and status not in('COMPLETED','CANCELLED');
 else raise exception 'Invalid goal transition';end if;
 insert into agentstack.kryx_task_events(user_id,goal_id,type,data) values(p_user,g.id,'goal.'||p_action,'{}');end $$;

create function agentstack.kryx_remember(p_user uuid,p_scope text,p_type text,p_key text,p_value jsonb,p_source jsonb) returns void language sql security invoker set search_path='' as $$
 insert into agentstack.kryx_memories(user_id,scope,type,key,value,source) values(p_user,p_scope,p_type,p_key,p_value,p_source) on conflict(user_id,scope,type,key) do update set value=excluded.value,source=excluded.source,last_verified_at=now(),times_confirmed=case when kryx_memories.value=excluded.value then kryx_memories.times_confirmed+1 else 1 end,confidence=case when kryx_memories.value=excluded.value then least(.95,kryx_memories.confidence+.05) else .5 end $$;

create function agentstack.kryx_finish(p_task uuid,p_token uuid,p_output jsonb,p_artifacts jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;a jsonb;m jsonb;begin
 select * into t from agentstack.kryx_tasks where id=p_task and lease_token=p_token and status='RUNNING' and lease_until>now() for update;if t.id is null then raise exception 'Lease lost';end if;
 perform 1 from agentstack.kryx_goals where id=t.goal_id and status='RUNNING' for update;if not found then raise exception 'Goal stopped';end if;
 for a in select value from jsonb_array_elements(p_artifacts) loop
 insert into agentstack.kryx_artifacts(user_id,goal_id,task_id,name,type,content,mime,sources) values(t.user_id,t.goal_id,t.id,a->>'name',a->>'type',a->>'content',a->>'mime',coalesce(a->'sources','[]'));
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'artifact.created',jsonb_build_object('name',a->>'name'));end loop;
 for m in select value from jsonb_array_elements(coalesce(p_output->'_memories','[]')) loop perform agentstack.kryx_remember(t.user_id,'workspace',m->>'type',m->>'key',m->'value',m->'source');end loop;
 if jsonb_array_length(coalesce(p_output->'changes','[]'))>0 then insert into agentstack.kryx_notifications(user_id,goal_id,task_id,text) values(t.user_id,t.goal_id,t.id,'Kryx found material competitor changes: '||(p_output->'changes')::text);end if;
 update agentstack.kryx_tasks set status='COMPLETED',progress=100,output=p_output-'_memories',completed_at=now(),lease_until=null where id=t.id;
 update agentstack.kryx_task_runs set status='COMPLETED',completed_at=now() where task_id=t.id and lease_token=p_token;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'task.completed',jsonb_build_object('title',t.title,'summary',p_output->'summary'));
 if not exists(select 1 from agentstack.kryx_tasks where goal_id=t.goal_id and status not in('COMPLETED','CANCELLED')) then
 update agentstack.kryx_goals set status=case when exists(select 1 from agentstack.kryx_approvals where goal_id=t.goal_id and status in('PENDING','APPROVED','EXECUTING','UNKNOWN')) then 'WAITING_FOR_APPROVAL' else 'COMPLETED' end,completed_at=case when exists(select 1 from agentstack.kryx_approvals where goal_id=t.goal_id and status in('PENDING','APPROVED','EXECUTING','UNKNOWN')) then null else now() end where id=t.goal_id;end if;end $$;

create function agentstack.kryx_fail(p_task uuid,p_token uuid,p_error text) returns void language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;begin
 update agentstack.kryx_tasks set status=case when retry_count>=max_retries then 'FAILED' else 'WAITING' end,error=p_error,available_at=now()+make_interval(secs=>15*power(2,retry_count)::int),lease_until=null where id=p_task and lease_token=p_token and status='RUNNING' returning * into t;
 if t.id is null then return;end if;
 update agentstack.kryx_task_runs set status='FAILED',error=p_error,completed_at=now() where task_id=t.id and lease_token=p_token;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'task.failed',jsonb_build_object('error',p_error,'retry',t.retry_count));
 if t.status='FAILED' then update agentstack.kryx_goals set status='FAILED',error=p_error where id=t.goal_id;end if;end $$;

create function agentstack.kryx_reserve_tool(p_task uuid,p_token uuid,p_key text,p_action text,p_provider text,p_input jsonb,p_credits integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;r agentstack.kryx_tool_runs;g agentstack.kryx_goals;begin
 select * into t from agentstack.kryx_tasks where id=p_task and lease_token=p_token and status='RUNNING' and lease_until>now() for update;if t.id is null then raise exception 'Lease lost';end if;
 select * into r from agentstack.kryx_tool_runs where task_id=p_task and idempotency_key=p_key;
 if r.id is not null then
   if r.status<>'COMPLETED' then
     update agentstack.kryx_tool_runs set status='RUNNING',error=null where id=r.id returning * into r;
     update agentstack.kryx_task_steps set status='RUNNING',retry_count=retry_count+1,last_error=null,last_heartbeat=now() where task_id=p_task and idempotency_key=p_key;
   end if;
   return to_jsonb(r);
 end if;
 select * into g from agentstack.kryx_goals where id=t.goal_id and status in('PLANNING','RUNNING') for update;if g.id is null then raise exception 'Goal stopped';end if;
 if p_credits<0 or g.spent+p_credits>g.budget then raise exception 'Task budget exhausted';end if;
 update agentstack.profiles set credit_balance=credit_balance-p_credits,credits_spent=coalesce(credits_spent,0)+p_credits where id=t.user_id and credit_balance>=p_credits;if not found then raise exception 'Insufficient credits';end if;
 insert into agentstack.credit_events(user_id,service,action,credits,meta) values(t.user_id,p_provider,p_action,p_credits,jsonb_build_object('goal_id',g.id,'task_id',t.id,'idempotency_key',p_key));
 update agentstack.kryx_goals set spent=spent+p_credits where id=g.id;
 insert into agentstack.kryx_tool_runs(user_id,goal_id,task_id,idempotency_key,action,provider,input,credits) values(t.user_id,t.goal_id,t.id,p_key,p_action,p_provider,p_input,p_credits) returning * into r;
 insert into agentstack.kryx_task_steps(user_id,task_id,idempotency_key,status,last_heartbeat) values(t.user_id,t.id,p_key,'RUNNING',now());return to_jsonb(r);end $$;

create function agentstack.kryx_decide_approval(p_user uuid,p_id uuid,p_decision text) returns void language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_approvals;begin if p_decision not in('APPROVED','DENIED') then raise exception 'Invalid decision';end if;
 update agentstack.kryx_approvals set status=p_decision where id=p_id and user_id=p_user and status='PENDING' and expires_at>now() returning * into a;if a.id is null then raise exception 'Approval unavailable';end if;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(a.user_id,a.goal_id,a.task_id,'approval.'||lower(p_decision),jsonb_build_object('approval_id',a.id));end $$;

create function agentstack.kryx_consume_approval(p_user uuid,p_id uuid,p_fingerprint text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_approvals;begin
 update agentstack.kryx_approvals set status='EXECUTING',executed_at=now() where id=p_id and user_id=p_user and fingerprint=p_fingerprint and status='APPROVED' and expires_at>now() and exists(select 1 from agentstack.kryx_goals g where g.id=goal_id and g.status not in('PAUSED','CANCELLED','FAILED')) returning * into a;
 if a.id is null then raise exception 'No approved unused action';end if;
 insert into agentstack.kryx_tool_runs(user_id,goal_id,task_id,idempotency_key,action,provider,input)
 values(a.user_id,a.goal_id,a.task_id,'approval:'||a.id,a.action,'resend',a.payload);
 insert into agentstack.kryx_task_steps(user_id,task_id,idempotency_key,status,last_heartbeat)
 values(a.user_id,a.task_id,'approval:'||a.id,'RUNNING',now());
 return to_jsonb(a);end $$;

create function agentstack.kryx_action_ack(p_user uuid,p_id uuid,p_provider text) returns void language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_approvals;begin
 if p_provider is null or length(p_provider)=0 or length(p_provider)>200 then raise exception 'Invalid provider acknowledgement';end if;
 update agentstack.kryx_approvals set status='EXECUTED',provider_id=p_provider,error=null where id=p_id and user_id=p_user and status='EXECUTING' returning * into a;
 if a.id is null then raise exception 'No executing approved action';end if;
 update agentstack.kryx_tool_runs set status='COMPLETED',output=jsonb_build_object('provider_id',p_provider),completed_at=now() where task_id=a.task_id and user_id=p_user and idempotency_key='approval:'||a.id;
 update agentstack.kryx_task_steps set status='COMPLETED',last_heartbeat=now() where task_id=a.task_id and user_id=p_user and idempotency_key='approval:'||a.id;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(p_user,a.goal_id,a.task_id,'action.executed',jsonb_build_object('action',a.action,'provider_id',p_provider));
end $$;

create function agentstack.kryx_claim_routines() returns setof agentstack.kryx_routines language sql security invoker set search_path='' as $$
 update agentstack.kryx_routines set lease_until=now()+interval '2 minutes' where id in(select id from agentstack.kryx_routines where enabled and next_run<=now() and (lease_until is null or lease_until<now()) order by next_run for update skip locked limit 10) returning * $$;

create function agentstack.kryx_reconcile() returns void language plpgsql security invoker set search_path='' as $$
begin
 update agentstack.kryx_tasks set status='FAILED',error='Worker stopped after final attempt' where status='RUNNING' and lease_until<now() and retry_count>=max_retries;
 update agentstack.kryx_goals g set status='FAILED',error='A task exhausted retries. Review Activity and resume.' where g.status in('RUNNING','PLANNING') and exists(select 1 from agentstack.kryx_tasks t where t.goal_id=g.id and t.status='FAILED');
 update agentstack.kryx_approvals set status='UNKNOWN',error='Delivery acknowledgement missing. Inspect provider before retry.' where status='EXECUTING' and executed_at<now()-interval '2 minutes';
 update agentstack.kryx_notifications set status='UNKNOWN' where status='SENDING' and started_at<now()-interval '2 minutes';
 update agentstack.kryx_approvals set status='EXPIRED' where status in('PENDING','APPROVED') and expires_at<now();
 update agentstack.kryx_goals g set status='COMPLETED',completed_at=now() where g.status='WAITING_FOR_APPROVAL' and not exists(select 1 from agentstack.kryx_approvals a where a.goal_id=g.id and a.status in('PENDING','APPROVED','EXECUTING','UNKNOWN'));
 update agentstack.kryx_tool_runs tr set status='UNKNOWN',error=a.error from agentstack.kryx_approvals a where tr.idempotency_key='approval:'||a.id and tr.user_id=a.user_id and tr.task_id=a.task_id and a.status='UNKNOWN' and tr.status='RUNNING';
end $$;

do $$ declare n text;f record;begin
 for n in select unnest(array['goals','tasks','task_dependencies','task_runs','task_steps','task_events','artifacts','approvals','approval_rules','memories','skills','routines','computer_sessions','tool_runs','trigger_events','notifications','email_suppressions']) loop
 execute format('alter table agentstack.kryx_%I enable row level security',n);
 execute format('revoke all on agentstack.kryx_%I from anon, authenticated',n);
 execute format('grant select on agentstack.kryx_%I to authenticated',n);
 execute format('grant all on agentstack.kryx_%I to service_role',n);
 execute format('create policy owner_read on agentstack.kryx_%I for select to authenticated using ((select auth.uid())=user_id)',n);end loop;
 grant usage,select on sequence agentstack.kryx_task_events_id_seq to service_role;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='agentstack' and p.proname like 'kryx_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;
end $$;

-- Registration is required: the existing heartbeat only dispatches persisted workers.
insert into agentstack.cron_ticks(worker,last_run_at) values('operator',null) on conflict(worker) do nothing;
