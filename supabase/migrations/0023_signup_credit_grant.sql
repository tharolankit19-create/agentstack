-- PAYG activation + one-time signup credits.
--
-- Kryx is now pay-as-you-go. A founder should be able to create and run the
-- built-in team without starting a subscription trial; metered specialist work
-- is stopped atomically by spend_credits when the wallet cannot afford it.
--
-- New profiles receive 100 credits ($1 customer-facing) exactly once. Existing
-- balances are never refilled here.

alter table agentstack.profiles
  alter column credit_balance set default 100;

-- Kryx + the seven built-in specialists. Legacy PAYG rows with a zero quota
-- would otherwise still fail the old database quota trigger.
alter table agentstack.profiles
  alter column agent_quota set default 8;

update agentstack.profiles
set agent_quota = greatest(agent_quota, 8)
where agent_quota < 8;

comment on column agentstack.profiles.credit_balance is
  'Prepaid Kryx credits. New profiles start with a one-time 100-credit starter grant; purchased credits never expire.';

-- PAYG accounts are entitled to configure and run the product. The wallet is
-- the money gate; this function is only an access/runtime gate now.
create or replace function agentstack.is_entitled(p agentstack.profiles)
returns boolean
language sql
stable
as $$
  select p.id is not null
$$;

-- Keep the database quota guard, but remove the obsolete subscription/trial
-- requirement. The browser can never bypass this count.
create or replace function agentstack.enforce_agent_quota()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  prof agentstack.profiles;
  used integer;
  quota integer;
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

  quota := greatest(prof.agent_quota, 8);

  select count(*) into used
  from agentstack.agents
  where user_id = new.user_id;

  if used >= quota then
    raise exception 'Agent limit reached (% of %).', used, quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Profile bootstrap: all signup methods converge here, including OAuth.
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
    credit_balance,
    credits_purchased,
    credits_spent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    8,
    100,
    0,
    0
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
