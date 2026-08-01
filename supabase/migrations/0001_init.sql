-- AgentStack — initial schema.
--
-- Two rules shape this file:
--
--   1. Row Level Security is on for every table, and the policies are written
--      so that a leaked anon key gets an attacker exactly nothing.
--   2. Anything a customer must never see — their own encrypted API keys, an
--      agent's bearer token hash — lives in a table with RLS enabled and no
--      policies at all. Only the service role reaches it, and the service role
--      key never leaves the server.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type public.plan_tier as enum ('none', 'starter', 'pro');

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  plan         public.plan_tier not null default 'none',
  agent_quota  integer not null default 0,
  purchased_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.profiles.agent_quota is
  'How many agents this customer may create. 0 until payment clears.';

alter table public.profiles enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

-- Deliberately no INSERT policy: rows are created by the trigger below.
-- Deliberately no UPDATE policy on plan/quota: only the payment webhook,
-- running as the service role, may grant entitlements.

create policy "owners may edit their own profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from public.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- purchases — one row per completed Dodo payment
-- ---------------------------------------------------------------------------

create table public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  provider            text not null default 'dodo',
  provider_payment_id text not null,
  plan                public.plan_tier not null,
  amount_cents        integer not null,
  currency            text not null default 'USD',
  status              text not null,
  payload             jsonb,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

alter table public.purchases enable row level security;

create policy "customers may read their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- agents — one row per configured agent instance
-- ---------------------------------------------------------------------------

create type public.agent_status as enum (
  'draft', 'configured', 'deploying', 'deployed', 'error'
);

create table public.agents (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users on delete cascade,
  template_id          text not null,
  name                 text not null,
  status               public.agent_status not null default 'draft',
  -- Non-secret settings only: website URL, tone, ICP, and so on.
  config               jsonb not null default '{}'::jsonb,
  -- Names of the secrets the customer has supplied. Never the values.
  secret_keys          text[] not null default '{}',
  paused               boolean not null default false,
  deploy_url           text,
  vercel_project_id    text,
  vercel_deployment_id text,
  last_error           text,
  last_run_at          timestamptz,
  deployed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index agents_user_id_idx on public.agents (user_id, created_at desc);

alter table public.agents enable row level security;

create policy "customers may read their own agents"
  on public.agents for select
  using (auth.uid() = user_id);

create policy "customers may create agents for themselves"
  on public.agents for insert
  with check (auth.uid() = user_id);

create policy "customers may update their own agents"
  on public.agents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "customers may delete their own agents"
  on public.agents for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- agent_secrets — service role only. No policies on purpose.
-- ---------------------------------------------------------------------------

create table public.agent_secrets (
  agent_id         uuid primary key references public.agents on delete cascade,
  user_id          uuid not null references auth.users on delete cascade,
  -- AES-256-GCM envelope produced by src/lib/crypto.ts. Never a plaintext key.
  ciphertext       text not null,
  -- SHA-256 of the bearer token the deployed agent presents on callbacks.
  -- Hashed because verifying a callback only needs a comparison.
  agent_token_hash text,
  -- The same token, encrypted. The platform has to *present* this token when
  -- it forwards a chat turn to the deployment, so this one must be reversible.
  agent_token_enc  text,
  updated_at       timestamptz not null default now()
);

alter table public.agent_secrets enable row level security;

comment on table public.agent_secrets is
  'Encrypted customer API keys. RLS is enabled with zero policies, so this table is unreachable with an anon or authenticated key — service role only.';

-- ---------------------------------------------------------------------------
-- agent_runs
-- ---------------------------------------------------------------------------

create table public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references public.agents on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  external_run_id text,
  trigger         text not null default 'manual',
  status          text not null default 'running',
  output          text,
  error           text,
  usage           jsonb,
  iterations      integer,
  tool_calls      integer,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  unique (agent_id, external_run_id)
);

create index agent_runs_agent_idx on public.agent_runs (agent_id, started_at desc);
create index agent_runs_user_month_idx on public.agent_runs (user_id, started_at desc);

alter table public.agent_runs enable row level security;

create policy "customers may read their own runs"
  on public.agent_runs for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- generations — the artifacts an agent produced
-- ---------------------------------------------------------------------------

create table public.generations (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references public.agents on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  run_id     uuid references public.agent_runs on delete set null,
  kind       text not null,
  content    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index generations_agent_idx on public.generations (agent_id, created_at desc);
create index generations_user_month_idx on public.generations (user_id, created_at desc);

alter table public.generations enable row level security;

create policy "customers may read their own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "customers may delete their own generations"
  on public.generations for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chat_messages — dashboard conversation with a deployed agent
-- ---------------------------------------------------------------------------

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references public.agents on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_agent_idx on public.chat_messages (agent_id, created_at);

alter table public.chat_messages enable row level security;

create policy "customers may read their own chat"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "customers may delete their own chat"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- webhook_events — idempotency for the payment provider. Service role only.
-- ---------------------------------------------------------------------------

create table public.webhook_events (
  id         text primary key,
  provider   text not null default 'dodo',
  type       text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Quota enforcement
--
-- The API route checks the quota before inserting, but the check lives here
-- too: a bug in one route should not be able to hand out free agents.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_agent_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quota integer;
  used  integer;
begin
  select agent_quota into quota from public.profiles where id = new.user_id;

  if quota is null or quota = 0 then
    raise exception 'No active plan. Buy AgentStack before creating an agent.'
      using errcode = 'check_violation';
  end if;

  select count(*) into used from public.agents where user_id = new.user_id;

  if used >= quota then
    raise exception 'Agent limit reached (% of %). Upgrade to add more.', used, quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger agents_enforce_quota
  before insert on public.agents
  for each row execute function public.enforce_agent_quota();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger agents_touch_updated_at
  before update on public.agents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dashboard counters
--
-- security_invoker keeps the caller's RLS in force, so this view cannot be
-- used to read another customer's numbers.
-- ---------------------------------------------------------------------------

create view public.agent_stats
with (security_invoker = on) as
select
  a.id as agent_id,
  a.user_id,
  (
    select count(*) from public.generations g
    where g.agent_id = a.id
      and g.created_at >= date_trunc('month', now())
  ) as generations_this_month,
  (
    select count(*) from public.agent_runs r
    where r.agent_id = a.id
      and r.started_at >= date_trunc('month', now())
  ) as runs_this_month,
  (
    select max(r.started_at) from public.agent_runs r where r.agent_id = a.id
  ) as last_run_at
from public.agents a;
