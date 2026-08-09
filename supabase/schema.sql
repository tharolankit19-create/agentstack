-- AgentStack — the complete schema, in one file.
--
-- Paste this whole file into your Supabase project's SQL Editor and hit Run.
-- It is the concatenation of everything in supabase/migrations/, in order, so
-- a fresh project needs exactly one action instead of several.
--
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Already ran some migrations individually? Run only the ones you have not,
-- and skip this file — it assumes a clean project and will error on objects
-- that already exist.
--
-- Verify afterwards with:
--   curl -s https://your-app.vercel.app/api/health | jq .database
--
-- Generated from the migrations. Do not edit by hand; edit a migration and
-- regenerate with: node scripts/build-schema.mjs


-- ========================================================================
-- 0001_init.sql
-- ========================================================================

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
-- The schema
--
-- AgentStack owns `agentstack`, not `public`. Two reasons, and the second is
-- the one that matters:
--
--   1. `public` is a shared room. Extensions land there, other tools create
--      things there, and a table called `subscriptions` is a name three
--      different products will each want.
--   2. It makes this installable into a Supabase project that is already
--      doing something else, without a single DROP. Nothing outside this
--      schema is touched by any migration in this directory.
--
-- The grants below are what Supabase applies to `public` automatically and
-- does not apply to a schema you make yourself. They look alarming and are
-- not: every table has RLS enabled, and the tables holding secrets have RLS
-- with no policies at all, so `anon` reaching them still gets nothing. The
-- grant is what lets PostgREST see the schema; the policies are what decide
-- who reads what.
-- ---------------------------------------------------------------------------

create schema if not exists agentstack;

grant usage on schema agentstack to anon, authenticated, service_role;

alter default privileges in schema agentstack
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema agentstack
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema agentstack
  grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type agentstack.plan_tier as enum ('none', 'starter', 'pro');

create table agentstack.profiles (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  plan         agentstack.plan_tier not null default 'none',
  agent_quota  integer not null default 0,
  purchased_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column agentstack.profiles.agent_quota is
  'How many agents this customer may create. 0 until payment clears.';

alter table agentstack.profiles enable row level security;

create policy "profiles are readable by their owner"
  on agentstack.profiles for select
  using (auth.uid() = id);

-- Deliberately no INSERT policy: rows are created by the trigger below.
-- Deliberately no UPDATE policy on plan/quota: only the payment webhook,
-- running as the service role, may grant entitlements.

create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- purchases — one row per completed Dodo payment
-- ---------------------------------------------------------------------------

create table agentstack.purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  provider            text not null default 'dodo',
  provider_payment_id text not null,
  plan                agentstack.plan_tier not null,
  amount_cents        integer not null,
  currency            text not null default 'USD',
  status              text not null,
  payload             jsonb,
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

alter table agentstack.purchases enable row level security;

create policy "customers may read their own purchases"
  on agentstack.purchases for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- agents — one row per configured agent instance
-- ---------------------------------------------------------------------------

create type agentstack.agent_status as enum (
  'draft', 'configured', 'deploying', 'deployed', 'error'
);

create table agentstack.agents (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users on delete cascade,
  template_id          text not null,
  name                 text not null,
  status               agentstack.agent_status not null default 'draft',
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

create index agents_user_id_idx on agentstack.agents (user_id, created_at desc);

alter table agentstack.agents enable row level security;

create policy "customers may read their own agents"
  on agentstack.agents for select
  using (auth.uid() = user_id);

create policy "customers may create agents for themselves"
  on agentstack.agents for insert
  with check (auth.uid() = user_id);

create policy "customers may update their own agents"
  on agentstack.agents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "customers may delete their own agents"
  on agentstack.agents for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- agent_secrets — service role only. No policies on purpose.
-- ---------------------------------------------------------------------------

create table agentstack.agent_secrets (
  agent_id         uuid primary key references agentstack.agents on delete cascade,
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

alter table agentstack.agent_secrets enable row level security;

comment on table agentstack.agent_secrets is
  'Encrypted customer API keys. RLS is enabled with zero policies, so this table is unreachable with an anon or authenticated key — service role only.';

-- ---------------------------------------------------------------------------
-- agent_runs
-- ---------------------------------------------------------------------------

create table agentstack.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  agent_id        uuid not null references agentstack.agents on delete cascade,
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

create index agent_runs_agent_idx on agentstack.agent_runs (agent_id, started_at desc);
create index agent_runs_user_month_idx on agentstack.agent_runs (user_id, started_at desc);

alter table agentstack.agent_runs enable row level security;

create policy "customers may read their own runs"
  on agentstack.agent_runs for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- generations — the artifacts an agent produced
-- ---------------------------------------------------------------------------

create table agentstack.generations (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agentstack.agents on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  run_id     uuid references agentstack.agent_runs on delete set null,
  kind       text not null,
  content    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index generations_agent_idx on agentstack.generations (agent_id, created_at desc);
create index generations_user_month_idx on agentstack.generations (user_id, created_at desc);

alter table agentstack.generations enable row level security;

create policy "customers may read their own generations"
  on agentstack.generations for select
  using (auth.uid() = user_id);

create policy "customers may delete their own generations"
  on agentstack.generations for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chat_messages — dashboard conversation with a deployed agent
-- ---------------------------------------------------------------------------

create table agentstack.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agentstack.agents on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_agent_idx on agentstack.chat_messages (agent_id, created_at);

alter table agentstack.chat_messages enable row level security;

create policy "customers may read their own chat"
  on agentstack.chat_messages for select
  using (auth.uid() = user_id);

create policy "customers may delete their own chat"
  on agentstack.chat_messages for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- webhook_events — idempotency for the payment provider. Service role only.
-- ---------------------------------------------------------------------------

create table agentstack.webhook_events (
  id         text primary key,
  provider   text not null default 'dodo',
  type       text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

alter table agentstack.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Quota enforcement
--
-- The API route checks the quota before inserting, but the check lives here
-- too: a bug in one route should not be able to hand out free agents.
-- ---------------------------------------------------------------------------

create or replace function agentstack.enforce_agent_quota()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  quota integer;
  used  integer;
begin
  select agent_quota into quota from agentstack.profiles where id = new.user_id;

  if quota is null or quota = 0 then
    raise exception 'No active plan. Buy AgentStack before creating an agent.'
      using errcode = 'check_violation';
  end if;

  select count(*) into used from agentstack.agents where user_id = new.user_id;

  if used >= quota then
    raise exception 'Agent limit reached (% of %). Upgrade to add more.', used, quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger agents_enforce_quota
  before insert on agentstack.agents
  for each row execute function agentstack.enforce_agent_quota();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on signup
-- ---------------------------------------------------------------------------

create or replace function agentstack.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  insert into agentstack.profiles (id, email, full_name, avatar_url)
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

-- Named for this app, not for the event.
--
-- `auth.users` belongs to Supabase and is shared by every application in the
-- project, so a trigger called `on_auth_user_created` is a name collision
-- waiting to happen — and it happened: another app in this project already
-- had one. Triggers on the same table coexist happily; identical names do
-- not. Anything we attach to a schema we do not own carries our name.
drop trigger if exists agentstack_on_auth_user_created on auth.users;

create trigger agentstack_on_auth_user_created
  after insert on auth.users
  for each row execute function agentstack.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function agentstack.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on agentstack.profiles
  for each row execute function agentstack.touch_updated_at();

create trigger agents_touch_updated_at
  before update on agentstack.agents
  for each row execute function agentstack.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dashboard counters
--
-- security_invoker keeps the caller's RLS in force, so this view cannot be
-- used to read another customer's numbers.
-- ---------------------------------------------------------------------------

create view agentstack.agent_stats
with (security_invoker = on) as
select
  a.id as agent_id,
  a.user_id,
  (
    select count(*) from agentstack.generations g
    where g.agent_id = a.id
      and g.created_at >= date_trunc('month', now())
  ) as generations_this_month,
  (
    select count(*) from agentstack.agent_runs r
    where r.agent_id = a.id
      and r.started_at >= date_trunc('month', now())
  ) as runs_this_month,
  (
    select max(r.started_at) from agentstack.agent_runs r where r.agent_id = a.id
  ) as last_run_at
from agentstack.agents a;

-- ========================================================================
-- 0002_subscriptions_and_custom_agents.sql
-- ========================================================================

-- AgentStack — monthly subscriptions, and agents generated from a customer's
-- own SaaS.
--
-- Two product changes drive this migration:
--   1. Billing is a recurring subscription, not a one-time purchase. Access is
--      therefore a thing that can be taken away, which the schema now models.
--   2. Premium customers point us at a SaaS they already pay for and we
--      generate an agent that replaces it.

-- ---------------------------------------------------------------------------
-- Subscription state on the profile
-- ---------------------------------------------------------------------------

create type agentstack.subscription_status as enum (
  'none', 'active', 'past_due', 'cancelled', 'expired'
);

alter table agentstack.profiles
  add column subscription_id        text,
  add column subscription_status    agentstack.subscription_status not null default 'none',
  add column current_period_end     timestamptz,
  add column cancel_at_period_end   boolean not null default false;

comment on column agentstack.profiles.current_period_end is
  'When paid access lapses if the subscription is not renewed. Null when there has never been one.';

create index profiles_subscription_idx on agentstack.profiles (subscription_id);

-- The one-time era called this "purchased_at". Renaming keeps the meaning
-- honest now that it marks the start of a recurring relationship.
alter table agentstack.profiles rename column purchased_at to subscribed_at;

-- purchases now records each successful charge in a subscription's life, not
-- a single lifetime purchase.
alter table agentstack.purchases
  add column subscription_id text,
  add column period_start    timestamptz,
  add column period_end      timestamptz;

comment on table agentstack.purchases is
  'One row per successful charge. A monthly subscription produces one per month.';

-- ---------------------------------------------------------------------------
-- Custom agents — generated by reading a customer's existing SaaS
-- ---------------------------------------------------------------------------

create type agentstack.custom_agent_status as enum (
  'analyzing', 'ready', 'failed'
);

create table agentstack.custom_agents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- What the customer asked us to replace.
  source_url   text not null,
  source_name  text,
  status       agentstack.custom_agent_status not null default 'analyzing',
  -- The generated spec the runtime consumes. Contains no credentials: the API
  -- key lives in agent_secrets like every other secret.
  spec         jsonb,
  -- What the generator actually read, so a customer can check our work.
  sources      text[] not null default '{}',
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index custom_agents_user_idx on agentstack.custom_agents (user_id, created_at desc);

alter table agentstack.custom_agents enable row level security;

create policy "customers may read their own custom agents"
  on agentstack.custom_agents for select
  using (auth.uid() = user_id);

create policy "customers may delete their own custom agents"
  on agentstack.custom_agents for delete
  using (auth.uid() = user_id);

-- Inserts and spec updates go through the server, which is what actually does
-- the scraping and generation.

create trigger custom_agents_touch_updated_at
  before update on agentstack.custom_agents
  for each row execute function agentstack.touch_updated_at();

-- An agent row may be backed by a generated spec instead of a bundled template.
alter table agentstack.agents
  add column custom_agent_id uuid references agentstack.custom_agents on delete set null;

-- ---------------------------------------------------------------------------
-- Losing access
--
-- When a subscription lapses the customer keeps their configuration and their
-- history — deleting someone's work because a card expired is hostile — but
-- every agent stops running. Resubscribing turns them back on.
-- ---------------------------------------------------------------------------

create or replace function agentstack.pause_agents_on_lapse()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  if new.agent_quota = 0 and old.agent_quota > 0 then
    update agentstack.agents set paused = true where user_id = new.id and not paused;
  end if;
  return new;
end;
$$;

create trigger profiles_pause_agents_on_lapse
  after update of agent_quota on agentstack.profiles
  for each row execute function agentstack.pause_agents_on_lapse();

-- ---------------------------------------------------------------------------
-- Savings — the number the dashboard leads with
--
-- security_invoker keeps the caller's RLS in force, so this cannot be used to
-- read another customer's numbers.
-- ---------------------------------------------------------------------------

create view agentstack.user_savings
with (security_invoker = on) as
select
  a.user_id,
  count(*) filter (where a.status = 'deployed')            as deployed_agents,
  count(*)                                                  as total_agents,
  (
    select count(*) from agentstack.generations g
    where g.user_id = a.user_id
      and g.created_at >= date_trunc('month', now())
  )                                                         as generations_this_month
from agentstack.agents a
group by a.user_id;

-- ========================================================================
-- 0003_onboarding.sql
-- ========================================================================

-- AgentStack — onboarding.
--
-- The dashboard now opens for anyone who has signed up and answered four
-- questions. Payment is enforced at the moment of action instead of at the
-- door: someone who cannot see what they are buying does not buy it.
--
-- What we ask is chosen to be useful on both sides. The customer's monthly
-- spend and current tools drive which agents we put in front of them first,
-- and the problem they picked is the sentence we lead their dashboard with.

alter table agentstack.profiles
  add column onboarded_at    timestamptz,
  add column company         text,
  -- Which problems brought them here. Free-form on purpose — the options can
  -- change without a migration.
  add column problems        text[] not null default '{}',
  -- What they told us they spend on SaaS each month, in USD.
  add column monthly_spend   integer,
  -- Tools they said they pay for. Optional; drives the agent ordering.
  add column current_tools   text[] not null default '{}';

comment on column agentstack.profiles.onboarded_at is
  'Null until the customer has finished onboarding. Gates the dashboard.';

-- Customers fill these in themselves, so the update policy has to allow it —
-- while still refusing any change to plan or agent_quota, which only the
-- payment webhook may touch.
drop policy if exists "owners may edit their own profile fields" on agentstack.profiles;

create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Self-healing profiles
--
-- The signup trigger creates a profile row, but a row can still be missing —
-- a user created before the trigger existed, or a restore. Without this the
-- app used to bounce such a user between /login and /dashboard forever.
-- ---------------------------------------------------------------------------

create or replace function agentstack.ensure_profile(user_id uuid, user_email text)
returns agentstack.profiles
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  result agentstack.profiles;
begin
  insert into agentstack.profiles (id, email)
  values (user_id, user_email)
  on conflict (id) do update set email = coalesce(agentstack.profiles.email, excluded.email)
  returning * into result;

  return result;
end;
$$;

revoke all on function agentstack.ensure_profile(uuid, text) from public;
grant execute on function agentstack.ensure_profile(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Support conversations
--
-- The floating helper keeps its history so a founder can close the tab and
-- come back to the same conversation.
-- ---------------------------------------------------------------------------

create table agentstack.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index support_messages_user_idx on agentstack.support_messages (user_id, created_at);

alter table agentstack.support_messages enable row level security;

create policy "customers may read their own support chat"
  on agentstack.support_messages for select
  using (auth.uid() = user_id);

create policy "customers may clear their own support chat"
  on agentstack.support_messages for delete
  using (auth.uid() = user_id);

-- ========================================================================
-- 0004_backfill_profiles.sql
-- ========================================================================

-- Backfill profiles for accounts created before the schema existed.
--
-- The signup trigger only fires on insert into auth.users. Anyone who signed
-- up while the database was still empty has an auth record and no profile —
-- and every page that reads `profiles` treats that as "not onboarded", which
-- is how a working account ends up stuck on the onboarding screen forever.
--
-- `ensure_profile` fixes one user at a time on demand. This fixes everyone who
-- is already in that state, once, at the moment the schema lands.
--
-- Safe to re-run: the conflict clause makes a second run a no-op.

insert into agentstack.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ========================================================================
-- 0005_unlimited_plan.sql
-- ========================================================================

-- Adds the third tier.
--
-- The plan ladder is now $29 / $59 / $149, and the difference between them is
-- how many agents run at once and whose servers they run on — not which agents
-- a customer is allowed to pick. Every tier has the whole library.
--
-- Safe to run on a database that already has 0001–0003 applied: adding an enum
-- value is idempotent with IF NOT EXISTS, and nothing below depends on the new
-- value existing beforehand.
--
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction as long as
-- the new value is not *used* in the same transaction. Nothing here uses it —
-- 'unlimited' only ever arrives as data, written by the payment webhook.

alter type agentstack.plan_tier add value if not exists 'unlimited';

comment on type agentstack.plan_tier is
  'none = signed up, never paid. starter = 3 agents, self-hosted. '
  'pro = 10 agents, we host them. unlimited = no cap, self-hosted.';

-- ========================================================================
-- 0006_grants.sql
-- ========================================================================

-- Grants, applied last.
--
-- 0001 sets ALTER DEFAULT PRIVILEGES so anything created after it is granted
-- automatically, but default privileges only ever apply to objects created
-- *afterwards* and only for the role that set them. This sweeps everything
-- that actually exists, so the outcome does not depend on which order someone
-- ran the files in or which role they were connected as.
--
-- Safe to re-run. Safe to run after adding a table — in fact, run it again.
--
-- To be clear about what this does and does not open up: PostgREST cannot see
-- a schema it has no USAGE on, and cannot see a table it has no SELECT on, so
-- these grants are what make the API work at all. They are not what decides
-- who sees which rows. That is Row Level Security, which is enabled on every
-- table in this schema — and the tables holding encrypted keys and token
-- hashes have RLS enabled with no policies whatsoever, so `anon` and
-- `authenticated` reaching them come back with nothing. Only the service role
-- bypasses RLS, and that key never leaves the server.

grant usage on schema agentstack to anon, authenticated, service_role;

grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all sequences in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
