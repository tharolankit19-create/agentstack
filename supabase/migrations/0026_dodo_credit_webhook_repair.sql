-- Repair the PAYG credit grant path for Dodo webhooks.
--
-- Safe to run on an existing Kryx database. It does not reset balances.
-- It only ensures the durable wallet table/function needed by the webhook exist.

alter table agentstack.profiles
  add column if not exists credit_balance integer not null default 100;

alter table agentstack.profiles
  alter column credit_balance set default 100;

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

drop policy if exists "owners read their credit topups" on agentstack.credit_topups;
create policy "owners read their credit topups"
  on agentstack.credit_topups for select
  using (auth.uid() = user_id);

create or replace function agentstack.add_credits(
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
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  if p_provider_ref is null or length(trim(p_provider_ref)) = 0 then
    raise exception 'provider ref required';
  end if;

  if not exists (select 1 from agentstack.profiles where id = p_user_id) then
    raise exception 'profile not found for credit grant';
  end if;

  insert into agentstack.credit_topups (
    user_id,
    credits,
    paid_cents,
    provider,
    provider_ref
  )
  values (
    p_user_id,
    p_credits,
    greatest(p_paid_cents, 0),
    'dodo',
    p_provider_ref
  )
  on conflict (provider, provider_ref) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update agentstack.profiles
    set credit_balance = credit_balance + p_credits
    where id = p_user_id
    returning credit_balance into current_balance;
  else
    select credit_balance
      into current_balance
    from agentstack.profiles
    where id = p_user_id;
  end if;

  return coalesce(current_balance, 0);
end;
$$;

grant all on agentstack.credit_topups to authenticated, service_role;
grant execute on function agentstack.add_credits(uuid, integer, integer, text) to service_role;
