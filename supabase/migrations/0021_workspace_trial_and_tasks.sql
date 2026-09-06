-- Free observation/setup, complete paid rosters, and truthful task states.
-- Apply after 0020_room.sql. No user data is deleted.
begin;

create or replace function agentstack.enforce_agent_quota()
returns trigger language plpgsql security definer
set search_path = agentstack, pg_temp as $$
declare prof agentstack.profiles; used integer; allowed integer;
begin
  select * into prof from agentstack.profiles where id = new.user_id for update;
  if prof.id is null then raise exception 'Profile not found.'; end if;
  if coalesce(prof.is_admin, false) then return new; end if;
  select count(*) into used from agentstack.agents where user_id = new.user_id;
  if not agentstack.is_entitled(prof) then
    if new.status <> 'draft' or not new.paused or new.custom_agent_id is not null then
      raise exception 'Start a trial to run agents.';
    end if;
    allowed := 13;
  else
    allowed := greatest(prof.agent_quota, case prof.plan when 'starter' then 13 when 'pro' then 26 when 'unlimited' then 999 else 0 end);
  end if;
  if used >= allowed then raise exception 'Agent limit reached (% of %).', used, allowed; end if;
  return new;
end;
$$;

update agentstack.profiles set agent_quota = greatest(agent_quota, 13) where plan = 'starter';
update agentstack.profiles set agent_quota = greatest(agent_quota, 26) where plan = 'pro';

alter table agentstack.scheduled_tasks drop constraint if exists scheduled_tasks_status_check;
alter table agentstack.scheduled_tasks add constraint scheduled_tasks_status_check
  check (status in ('pending', 'running', 'done', 'failed', 'cancelled'));

create index if not exists room_messages_agent_history_idx
  on agentstack.room_messages (user_id, agent_id, created_at desc);
create index if not exists generations_owner_agent_idx
  on agentstack.generations (user_id, agent_id, created_at desc);

grant select on agentstack.chat_messages, agentstack.room_messages to authenticated;
grant all on agentstack.chat_messages, agentstack.room_messages, agentstack.scheduled_tasks to service_role;
notify pgrst, 'reload schema';
commit;
