-- Kryx production repair: payments, Room, recurring schedules and starter wallet.
-- Safe/idempotent for the existing agentstack schema. Does not touch Meamus,
-- public tables, or any other application schema.

create schema if not exists agentstack;
grant usage on schema agentstack to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PAYG wallet + webhook durability
-- ---------------------------------------------------------------------------
alter table if exists agentstack.profiles
  add column if not exists credit_balance integer not null default 100;
alter table if exists agentstack.profiles
  add column if not exists credits_purchased integer not null default 0;
alter table if exists agentstack.profiles
  add column if not exists credits_spent integer not null default 0;
alter table if exists agentstack.profiles
  alter column credit_balance set default 100;
alter table if exists agentstack.profiles
  alter column agent_quota set default 8;

create table if not exists agentstack.webhook_events (
  id text primary key,
  provider text not null default 'dodo',
  type text,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table agentstack.webhook_events enable row level security;
grant all on agentstack.webhook_events to service_role;

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
grant select on agentstack.credit_topups to authenticated;
grant all on agentstack.credit_topups to service_role;

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
  if p_credits <= 0 then raise exception 'credits must be positive'; end if;
  if p_provider_ref is null or length(trim(p_provider_ref)) = 0 then
    raise exception 'provider ref required';
  end if;
  if not exists (select 1 from agentstack.profiles where id = p_user_id) then
    raise exception 'profile not found for credit grant';
  end if;

  insert into agentstack.credit_topups(user_id, credits, paid_cents, provider, provider_ref)
  values (p_user_id, p_credits, greatest(p_paid_cents, 0), 'dodo', p_provider_ref)
  on conflict (provider, provider_ref) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update agentstack.profiles
      set credit_balance = credit_balance + p_credits,
          credits_purchased = coalesce(credits_purchased, 0) + p_credits
      where id = p_user_id
      returning credit_balance into current_balance;
  else
    select credit_balance into current_balance
      from agentstack.profiles where id = p_user_id;
  end if;

  return coalesce(current_balance, 0);
end;
$$;
revoke all on function agentstack.add_credits(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function agentstack.add_credits(uuid, integer, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- Room storage
-- ---------------------------------------------------------------------------
create table if not exists agentstack.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agentstack.agents(id) on delete set null,
  template_id text,
  body text not null,
  mentions text[] not null default '{}',
  generation_id uuid references agentstack.generations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists room_messages_user_idx
  on agentstack.room_messages(user_id, created_at desc);
alter table agentstack.room_messages enable row level security;
drop policy if exists "owners read their room" on agentstack.room_messages;
create policy "owners read their room"
  on agentstack.room_messages for select using (auth.uid() = user_id);
drop policy if exists "owners speak in their room" on agentstack.room_messages;
create policy "owners speak in their room"
  on agentstack.room_messages for insert
  with check (auth.uid() = user_id and agent_id is null);
grant select, insert on agentstack.room_messages to authenticated;
grant all on agentstack.room_messages to service_role;

-- ---------------------------------------------------------------------------
-- Founder-created recurring schedules
-- ---------------------------------------------------------------------------
create table if not exists agentstack.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agentstack.agents(id) on delete set null,
  instruction text not null check (length(instruction) between 1 and 2000),
  run_at timestamptz not null,
  when_label text,
  status text not null default 'pending'
    check (status in ('pending','done','failed','cancelled')),
  result text,
  error text,
  created_at timestamptz not null default now(),
  ran_at timestamptz
);
alter table agentstack.scheduled_tasks
  add column if not exists recurrence text not null default 'once';
alter table agentstack.scheduled_tasks
  add column if not exists timezone text not null default 'UTC';
alter table agentstack.scheduled_tasks
  drop constraint if exists scheduled_tasks_recurrence_check;
alter table agentstack.scheduled_tasks
  add constraint scheduled_tasks_recurrence_check
  check (recurrence in ('once','hourly','daily'));
create index if not exists scheduled_tasks_due_idx
  on agentstack.scheduled_tasks(status, run_at) where status = 'pending';
create index if not exists scheduled_tasks_user_idx
  on agentstack.scheduled_tasks(user_id, created_at desc);
alter table agentstack.scheduled_tasks enable row level security;
drop policy if exists "owners read their scheduled tasks" on agentstack.scheduled_tasks;
create policy "owners read their scheduled tasks"
  on agentstack.scheduled_tasks for select using (auth.uid() = user_id);
revoke insert, update, delete on agentstack.scheduled_tasks from authenticated;
grant select on agentstack.scheduled_tasks to authenticated;
grant all on agentstack.scheduled_tasks to service_role;

-- ---------------------------------------------------------------------------
-- New-user starter wallet + built-in team capacity
-- ---------------------------------------------------------------------------
create or replace function agentstack.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  insert into agentstack.profiles(
    id, email, full_name, avatar_url, agent_quota, credit_balance
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

drop trigger if exists agentstack_on_auth_user_created on auth.users;
create trigger agentstack_on_auth_user_created
  after insert on auth.users
  for each row execute function agentstack.handle_new_user();

-- Make PostgREST/RPC see the repaired objects immediately.
notify pgrst, 'reload schema';
