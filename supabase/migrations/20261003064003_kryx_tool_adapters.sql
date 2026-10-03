-- Additive read-adapter builder. Definitions can be read by their owner; lifecycle and vault writes are service-only.
create table agentstack.kryx_tool_adapters (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,goal_id uuid not null,task_id uuid not null,
 manifest jsonb not null,manifest_hash text not null,state text not null default 'DRAFT' check(state in('DRAFT','TESTED','INSTALLED','DISABLED')),
 installed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,user_id),unique(task_id),foreign key(task_id,user_id) references agentstack.kryx_tasks(id,user_id),foreign key(goal_id,user_id) references agentstack.kryx_goals(id,user_id),
 check(state='DISABLED' or state=manifest->>'state')
);
create index kryx_adapter_owner_state on agentstack.kryx_tool_adapters(user_id,state);
create table agentstack.kryx_adapter_credentials (
 adapter_id uuid primary key,user_id uuid not null,ciphertext text not null,updated_at timestamptz not null default now(),
 foreign key(adapter_id,user_id) references agentstack.kryx_tool_adapters(id,user_id)
);
alter table agentstack.kryx_tool_adapters enable row level security;
alter table agentstack.kryx_adapter_credentials enable row level security;
create policy owner_read on agentstack.kryx_tool_adapters for select to authenticated using ((select auth.uid())=user_id);
revoke all on agentstack.kryx_tool_adapters,agentstack.kryx_adapter_credentials from anon,authenticated;
grant select on agentstack.kryx_tool_adapters to authenticated;
grant all on agentstack.kryx_tool_adapters,agentstack.kryx_adapter_credentials to service_role;

create or replace function agentstack.kryx_finish(p_task uuid,p_token uuid,p_output jsonb,p_artifacts jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare t agentstack.kryx_tasks;a jsonb;m jsonb;begin
 select * into t from agentstack.kryx_tasks where id=p_task and lease_token=p_token and status='RUNNING' and lease_until>now() for update;if t.id is null then raise exception 'Lease lost';end if;
 perform 1 from agentstack.kryx_goals where id=t.goal_id and status='RUNNING' for update;if not found then raise exception 'Goal stopped';end if;
 if p_output ? '_adapter_proposal' then
 insert into agentstack.kryx_tool_adapters(user_id,goal_id,task_id,manifest,manifest_hash)
 values(t.user_id,t.goal_id,t.id,p_output->'_adapter_proposal'->'manifest',p_output->'_adapter_proposal'->>'manifest_hash');
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'tool.proposed',jsonb_build_object('name',p_output->'_adapter_proposal'->'manifest'->>'name'));
 end if;
 if p_output ? '_adapter_test' then
 update agentstack.kryx_tool_adapters set manifest=p_output->'_adapter_test'->'manifest',state=p_output->'_adapter_test'->'manifest'->>'state',updated_at=now()
 where id=(p_output->'_adapter_test'->>'id')::uuid and user_id=t.user_id and state in('DRAFT','TESTED') and manifest_hash=p_output->'_adapter_test'->>'manifest_hash';
 if not found then raise exception 'Adapter changed or was installed during testing';end if;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'tool.sandbox_tested',p_output->'_adapter_test'->'manifest'->'sandbox_result');
 end if;
 for a in select value from jsonb_array_elements(p_artifacts) loop
 insert into agentstack.kryx_artifacts(user_id,goal_id,task_id,name,type,content,mime,sources) values(t.user_id,t.goal_id,t.id,a->>'name',a->>'type',a->>'content',a->>'mime',coalesce(a->'sources','[]'));
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'artifact.created',jsonb_build_object('name',a->>'name'));end loop;
 for m in select value from jsonb_array_elements(coalesce(p_output->'_memories','[]')) loop perform agentstack.kryx_remember(t.user_id,'workspace',m->>'type',m->>'key',m->'value',m->'source');end loop;
 if jsonb_array_length(coalesce(p_output->'changes','[]'))>0 then insert into agentstack.kryx_notifications(user_id,goal_id,task_id,text) values(t.user_id,t.goal_id,t.id,'Kryx found material competitor changes: '||(p_output->'changes')::text);end if;
 update agentstack.kryx_tasks set status='COMPLETED',progress=100,output=p_output-'_memories'-'_adapter_proposal'-'_adapter_test',completed_at=now(),lease_until=null where id=t.id;
 update agentstack.kryx_task_runs set status='COMPLETED',completed_at=now() where task_id=t.id and lease_token=p_token;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(t.user_id,t.goal_id,t.id,'task.completed',jsonb_build_object('title',t.title,'summary',p_output->'summary'));
 if not exists(select 1 from agentstack.kryx_tasks where goal_id=t.goal_id and status not in('COMPLETED','CANCELLED')) then
 update agentstack.kryx_goals set status=case when exists(select 1 from agentstack.kryx_approvals where goal_id=t.goal_id and status in('PENDING','APPROVED','EXECUTING','UNKNOWN')) then 'WAITING_FOR_APPROVAL' else 'COMPLETED' end,completed_at=case when exists(select 1 from agentstack.kryx_approvals where goal_id=t.goal_id and status in('PENDING','APPROVED','EXECUTING','UNKNOWN')) then null else now() end where id=t.goal_id;end if;end $$;

create function agentstack.kryx_install_adapter(p_user uuid,p_adapter uuid,p_hash text,p_approved boolean) returns void language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_tool_adapters;begin
 select * into a from agentstack.kryx_tool_adapters where id=p_adapter and user_id=p_user for update;
 if a.id is not null and a.state='INSTALLED' and a.manifest_hash=p_hash and p_approved is true then return;end if;
 if a.id is null or not p_approved or p_approved is null or a.state<>'TESTED' or a.manifest_hash<>p_hash
 or a.manifest->'sandbox_result'->>'manifest_hash' is distinct from p_hash
 or a.manifest->'sandbox_result'->>'passed' is distinct from 'true'
 or coalesce((a.manifest->'sandbox_result'->>'tested_at')::timestamptz,'epoch')<now()-interval '7 days'
 or exists(select 1 from jsonb_array_elements(a.manifest->'actions') s where s->>'method'<>'GET' or s->>'risk'<>'READ')
 then raise exception 'A recent passing test and explicit approval of this exact read adapter are required';end if;
 update agentstack.kryx_tool_adapters set state='INSTALLED',manifest=jsonb_set(manifest,'{state}','"INSTALLED"'),installed_at=now(),updated_at=now() where id=a.id;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(p_user,a.goal_id,a.task_id,'tool.installed',jsonb_build_object('adapter_id',a.id,'manifest_hash',p_hash));
end $$;
create function agentstack.kryx_adapter_credential(p_user uuid,p_adapter uuid,p_ciphertext text) returns void language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_tool_adapters;begin
 select * into a from agentstack.kryx_tool_adapters where id=p_adapter and user_id=p_user and state='INSTALLED' for update;
 if a.id is null then raise exception 'Install the tested adapter before connecting a credential';end if;
 if p_ciphertext is null then delete from agentstack.kryx_adapter_credentials where adapter_id=a.id and user_id=p_user;
 else insert into agentstack.kryx_adapter_credentials(adapter_id,user_id,ciphertext) values(a.id,p_user,p_ciphertext)
 on conflict(adapter_id) do update set ciphertext=excluded.ciphertext,updated_at=now();end if;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(p_user,a.goal_id,a.task_id,'tool.credential_updated',jsonb_build_object('adapter_id',a.id,'connected',p_ciphertext is not null));
end $$;
create function agentstack.kryx_disable_adapter(p_user uuid,p_adapter uuid) returns void language plpgsql security invoker set search_path='' as $$
declare a agentstack.kryx_tool_adapters;begin
 select * into a from agentstack.kryx_tool_adapters where id=p_adapter and user_id=p_user for update;
 if a.id is null then raise exception 'Adapter not found';end if;
 update agentstack.kryx_tool_adapters set state='DISABLED',updated_at=now() where id=a.id;
 delete from agentstack.kryx_adapter_credentials where adapter_id=a.id and user_id=p_user;
 insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values(p_user,a.goal_id,a.task_id,'tool.disabled',jsonb_build_object('adapter_id',a.id));
end $$;
revoke execute on function agentstack.kryx_install_adapter(uuid,uuid,text,boolean),agentstack.kryx_adapter_credential(uuid,uuid,text),agentstack.kryx_disable_adapter(uuid,uuid) from public,anon,authenticated;
grant execute on function agentstack.kryx_install_adapter(uuid,uuid,text,boolean),agentstack.kryx_adapter_credential(uuid,uuid,text),agentstack.kryx_disable_adapter(uuid,uuid) to service_role;
