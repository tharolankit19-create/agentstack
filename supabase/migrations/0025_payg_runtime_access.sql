-- PAYG runtime access.
--
-- The public product is now $0/month with prepaid specialist credits. A new
-- founder must therefore be able to configure and activate the built-in Kryx
-- roster without first starting a subscription trial. Metered work is still
-- protected by agentstack.spend_credits(), which refuses atomically when the
-- wallet cannot afford the action.
--
-- Legacy paid plans remain valid. This only changes the access gate for
-- plan='none' accounts and gives those accounts room for Kryx + 7 built-ins.

alter table agentstack.profiles
  alter column agent_quota set default 8;

create or replace function agentstack.is_entitled(p agentstack.profiles)
returns boolean
language sql
stable
as $$
  select p.id is not null
$$;

create or replace function agentstack.enforce_agent_quota()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  prof agentstack.profiles;
  used integer;
  effective_quota integer;
begin
  select * into prof
  from agentstack.profiles
  where id = new.user_id;

  if prof.id is null then
    raise exception 'No profile for this user.'
      using errcode = 'check_violation';
  end if;

  if coalesce(prof.is_admin, false) then
    return new;
  end if;

  effective_quota := case
    when prof.plan = 'none' then greatest(coalesce(prof.agent_quota, 0), 8)
    else greatest(coalesce(prof.agent_quota, 0), 0)
  end;

  if effective_quota <= 0 then
    raise exception 'No agent capacity is configured for this account.'
      using errcode = 'check_violation';
  end if;

  select count(*) into used
  from agentstack.agents
  where user_id = new.user_id;

  if used >= effective_quota then
    raise exception 'Agent limit reached (% of %).', used, effective_quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- New profiles get enough built-in capacity immediately. Existing PAYG rows
-- do not need a destructive rewrite because enforce_agent_quota() and the app
-- both derive an effective minimum of 8 for plan='none'.
create or replace function agentstack.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  insert into agentstack.profiles (
    id,
    email,
    full_name,
    avatar_url,
    agent_quota,
    credit_balance
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    8,
    100
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
