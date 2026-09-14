-- KryxAI launch wallet: $1 free on signup, prepaid top-ups, no expiry.
-- 100 credits = $1 customer-facing. The database stores integer credits only.

alter table agentstack.profiles
  add column if not exists credit_balance integer not null default 100;

comment on column agentstack.profiles.credit_balance is
  'Prepaid KryxAI credits. New accounts start with 100 launch credits ($1 equivalent). Purchased credits do not expire.';

-- Existing profiles should receive the same launch grant once when this migration lands.
update agentstack.profiles
set credit_balance = greatest(credit_balance, 100)
where credit_balance < 100;

create table if not exists agentstack.credit_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  provider text not null default 'dodo',
  provider_ref text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists credit_topups_user_idx
  on agentstack.credit_topups(user_id, created_at desc);

alter table agentstack.credit_topups enable row level security;
create policy "owners read their credit topups" on agentstack.credit_topups
  for select using (auth.uid() = user_id);

-- Replace the old resettable allowance function with a durable prepaid wallet.
drop function if exists agentstack.spend_credits(uuid, uuid, text, text, integer);
create function agentstack.spend_credits(
  p_user_id uuid,
  p_agent_id uuid,
  p_service text,
  p_action text,
  p_credits integer
)
returns integer
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  current_balance integer;
  admin_user boolean;
begin
  if p_credits <= 0 then raise exception 'credits must be positive'; end if;

  select credit_balance, coalesce(is_admin, false)
    into current_balance, admin_user
  from agentstack.profiles
  where id = p_user_id
  for update;

  if current_balance is null then return -1; end if;

  if admin_user then
    insert into agentstack.credit_events(user_id, agent_id, service, action, credits)
    values (p_user_id, p_agent_id, p_service, p_action, p_credits);
    return 999999;
  end if;

  if current_balance < p_credits then return -1; end if;

  update agentstack.profiles
  set credit_balance = credit_balance - p_credits
  where id = p_user_id
  returning credit_balance into current_balance;

  insert into agentstack.credit_events(user_id, agent_id, service, action, credits)
  values (p_user_id, p_agent_id, p_service, p_action, p_credits);

  return current_balance;
end;
$$;

-- Idempotent top-up. A retried webhook never creates free duplicate credit.
drop function if exists agentstack.add_credits(uuid, integer, integer, text);
create function agentstack.add_credits(
  p_user_id uuid,
  p_credits integer,
  p_paid_cents integer,
  p_provider_ref text
)
returns integer
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  current_balance integer;
  inserted_id uuid;
begin
  if p_credits <= 0 then raise exception 'credits must be positive'; end if;
  if p_provider_ref is null or length(trim(p_provider_ref)) = 0 then raise exception 'provider ref required'; end if;

  insert into agentstack.credit_topups(user_id, credits, paid_cents, provider, provider_ref)
  values (p_user_id, p_credits, greatest(p_paid_cents, 0), 'dodo', p_provider_ref)
  on conflict (provider, provider_ref) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update agentstack.profiles
    set credit_balance = credit_balance + p_credits
    where id = p_user_id
    returning credit_balance into current_balance;
  else
    select credit_balance into current_balance from agentstack.profiles where id = p_user_id;
  end if;

  return coalesce(current_balance, 0);
end;
$$;

-- Do not allow a signed-in browser to grant itself balance.
drop policy if exists "owners may edit their own profile fields" on agentstack.profiles;
create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and credit_balance = (select p.credit_balance from agentstack.profiles p where p.id = auth.uid())
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from agentstack.profiles p where p.id = auth.uid())
  );

grant all on agentstack.credit_topups to authenticated, service_role;
grant execute on function agentstack.spend_credits(uuid, uuid, text, text, integer) to service_role;
grant execute on function agentstack.add_credits(uuid, integer, integer, text) to service_role;
