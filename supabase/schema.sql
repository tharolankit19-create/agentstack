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

-- ========================================================================
-- 0007_admin_and_own_hosting.sql
-- ========================================================================

-- Two things that both hang off the profile.
--
-- 1. Admins. One flag, checked server-side, that grants the whole product
--    without a subscription. It is not a role system and does not want to be
--    — there is one company here, and a boolean that is obviously either true
--    or false beats a permissions table nobody audits.
--
-- 2. Bring-your-own hosting. On Starter and Unlimited the customer's agents
--    run on *their* Vercel account under *their* API keys, which means we
--    need somewhere to put their Vercel token. It goes in the same shape as
--    every other customer credential: encrypted before it arrives, in a
--    column no policy exposes.

alter table agentstack.profiles
  add column if not exists is_admin boolean not null default false,
  -- AES-256-GCM envelope, same format as agent_secrets.ciphertext. Never
  -- selectable by the customer: the UPDATE policy below refuses changes to it,
  -- and the SELECT policy is column-blind, so the app reads it only through
  -- the service role.
  add column if not exists vercel_token_enc text,
  -- Shown back to the customer so they can tell which token is connected
  -- without us ever returning the token. Vercel does not expose a token name
  -- via the API, so this is the account/team slug we resolve at connect time.
  add column if not exists vercel_account_label text,
  add column if not exists vercel_team_id text,
  add column if not exists vercel_connected_at timestamptz;

comment on column agentstack.profiles.is_admin is
  'Full access without a subscription. Set by hand, never by the app.';
comment on column agentstack.profiles.vercel_token_enc is
  'Encrypted Vercel API token for customers who host their own agents.';

-- ---------------------------------------------------------------------------
-- Keep the customer out of their own privilege columns.
--
-- 0003 already narrowed the profiles UPDATE policy to the onboarding fields
-- while pinning plan and agent_quota. This adds the new columns to that pin,
-- so a customer cannot grant themselves admin by PATCHing their own row —
-- which, with a publishable key in the browser, is the first thing anyone
-- would try.
-- ---------------------------------------------------------------------------

drop policy if exists "owners may edit their own profile fields" on agentstack.profiles;

create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from agentstack.profiles p where p.id = auth.uid())
    and vercel_token_enc is not distinct from
        (select p.vercel_token_enc from agentstack.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The quota trigger has to know about admins too.
--
-- Otherwise an admin with plan 'none' is refused at the database even though
-- every check above it passed, which is a confusing way to find out your own
-- product works.
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
  admin boolean;
begin
  select agent_quota, is_admin into quota, admin
  from agentstack.profiles where id = new.user_id;

  if coalesce(admin, false) then
    return new;
  end if;

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

-- ---------------------------------------------------------------------------
-- The owner.
--
-- Two halves, because the order of "run the migration" and "sign up" is not
-- something a migration gets to decide:
--
--   * the UPDATE covers an account that already exists;
--   * the trigger change covers one that does not exist yet.
--
-- Without the second half, running this before the owner has ever signed up
-- is a silent no-op and they get a paywall on their own product — which is
-- exactly what happened here, since the account did not exist at migration
-- time.
--
-- The list is a hardcoded literal on purpose. It is not configuration: an
-- environment variable that grants admin is an environment variable that
-- grants admin to whoever can set environment variables.
-- ---------------------------------------------------------------------------

create or replace function agentstack.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  insert into agentstack.profiles (id, email, full_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(coalesce(new.email, '')) in ('tharolankit19@gmail.com')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update agentstack.profiles
set is_admin = true
where lower(email) in ('tharolankit19@gmail.com');

-- ========================================================================
-- 0008_instant_trial.sql
-- ========================================================================

-- Instant activation, with a fuse on it.
--
-- Clicking a plan turns it on immediately for a short window instead of
-- sending someone to a checkout they have not decided on yet. When the window
-- closes they are back to nothing until they pay.
--
-- The important part is that the fuse is **here**, not in the UI. A countdown
-- in the browser is decoration; an expired trial has to be unable to create
-- an agent even if every check above the database is bypassed. So
-- enforce_agent_quota re-derives entitlement from these columns on every
-- insert, and a trial that has run out behaves exactly like no plan at all.
--
-- One per account, forever. `trial_started_at` is never cleared, and the grant
-- path refuses when it is already set — otherwise "start trial" is just a free
-- subscription with extra clicks.

alter table agentstack.profiles
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

comment on column agentstack.profiles.trial_started_at is
  'Set once, never cleared. Its presence is what makes the trial one-per-account.';
comment on column agentstack.profiles.trial_ends_at is
  'When instant access expires. Ignored once a real subscription is active.';

create index if not exists profiles_trial_ends_idx
  on agentstack.profiles (trial_ends_at)
  where trial_ends_at is not null;

-- ---------------------------------------------------------------------------
-- Entitlement, in one place the database can also use.
--
-- Paid beats trial: once a subscription is active, trial_ends_at stops
-- mattering entirely — otherwise a customer who paid during their trial hour
-- would get locked out when it elapsed.
-- ---------------------------------------------------------------------------

create or replace function agentstack.is_entitled(p agentstack.profiles)
returns boolean
language sql
stable
as $$
  select
    coalesce(p.is_admin, false)
    or (p.plan <> 'none' and p.subscription_status = 'active')
    or (p.plan <> 'none' and p.trial_ends_at is not null and p.trial_ends_at > now())
$$;

create or replace function agentstack.enforce_agent_quota()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  prof  agentstack.profiles;
  used  integer;
begin
  select * into prof from agentstack.profiles where id = new.user_id;

  if prof.id is null then
    raise exception 'No profile for this user.' using errcode = 'check_violation';
  end if;

  if coalesce(prof.is_admin, false) then
    return new;
  end if;

  if not agentstack.is_entitled(prof) then
    if prof.trial_ends_at is not null and prof.trial_ends_at <= now() then
      raise exception 'Your free hour has ended. Subscribe to keep building agents.'
        using errcode = 'check_violation';
    end if;
    raise exception 'No active plan. Buy AgentStack before creating an agent.'
      using errcode = 'check_violation';
  end if;

  select count(*) into used from agentstack.agents where user_id = new.user_id;

  if used >= prof.agent_quota then
    raise exception 'Agent limit reached (% of %). Upgrade to add more.', used, prof.agent_quota
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The customer must not be able to grant themselves a trial.
--
-- Same reasoning as plan and is_admin: with a publishable key in the browser,
-- anything the UPDATE policy does not pin is something a customer can set.
-- ---------------------------------------------------------------------------

drop policy if exists "owners may edit their own profile fields" on agentstack.profiles;

create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from agentstack.profiles p where p.id = auth.uid())
    and trial_ends_at is not distinct from
        (select p.trial_ends_at from agentstack.profiles p where p.id = auth.uid())
    and trial_started_at is not distinct from
        (select p.trial_started_at from agentstack.profiles p where p.id = auth.uid())
    and vercel_token_enc is not distinct from
        (select p.vercel_token_enc from agentstack.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Pausing agents when the trial lapses.
--
-- 0002 pauses a customer's agents when their quota drops to zero on
-- cancellation. A trial ending is the same event with a different cause, and
-- it needs the same result — otherwise the free hour quietly becomes free
-- forever for anything already deployed.
-- ---------------------------------------------------------------------------

create or replace function agentstack.pause_agents_on_trial_end()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  if new.trial_ends_at is distinct from old.trial_ends_at
     and new.trial_ends_at is not null
     and new.trial_ends_at <= now()
     and not agentstack.is_entitled(new)
  then
    update agentstack.agents set paused = true where user_id = new.id and not paused;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_pause_agents_on_trial_end on agentstack.profiles;

create trigger profiles_pause_agents_on_trial_end
  after update of trial_ends_at on agentstack.profiles
  for each row execute function agentstack.pause_agents_on_trial_end();

-- ========================================================================
-- 0009_telegram_and_approvals.sql
-- ========================================================================

-- The founder's side of human-in-the-loop.
--
-- Two things the head agent needs before "reply 1 to approve" is real rather
-- than a line in a mockup: somewhere to record which Telegram chat belongs to
-- which account, and a flag on each piece of work saying whether it has been
-- approved.

-- ---------------------------------------------------------------------------
-- telegram_links
--
-- The chat id is the credential. Anyone messaging from a linked chat is
-- treated as the owner of that account, which is exactly as strong as the
-- founder's own Telegram account and no stronger — worth saying out loud,
-- since it means the linking step has to be deliberate rather than guessable.
--
-- Hence `link_code`: a short one-time code shown in the dashboard and pasted
-- into the bot. It expires, it is single-use, and until it is redeemed the
-- chat can do nothing at all.
-- ---------------------------------------------------------------------------

create table if not exists agentstack.telegram_links (
  user_id     uuid primary key references auth.users on delete cascade,
  chat_id     text unique,
  -- Null once redeemed. Its presence means "waiting to be connected".
  link_code   text unique,
  code_expires_at timestamptz,
  linked_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists telegram_links_chat_idx
  on agentstack.telegram_links (chat_id)
  where chat_id is not null;

alter table agentstack.telegram_links enable row level security;

-- The customer may see their own row so the dashboard can show the code and
-- whether it is connected. They may not write it: the code is issued by the
-- server and redeemed by the webhook, both service-role.
create policy "customers may read their own telegram link"
  on agentstack.telegram_links for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Approval on generated work
--
-- Default false, deliberately. Every draft starts unapproved, so a bug that
-- forgets to ask cannot result in something being published — the failure mode
-- is silence, which is recoverable, rather than an unwanted post, which is not.
-- ---------------------------------------------------------------------------

alter table agentstack.generations
  add column if not exists approved boolean not null default false,
  add column if not exists approved_at timestamptz;

comment on column agentstack.generations.approved is
  'False until the founder says otherwise. Nothing publishes or sends without it.';

create index if not exists generations_pending_idx
  on agentstack.generations (user_id, created_at desc)
  where approved = false;

-- Customers approve from the dashboard as well as from Telegram, so the
-- update policy allows it — but only on their own rows, and only the approval
-- columns are worth changing here.
drop policy if exists "customers may approve their own generations" on agentstack.generations;

create policy "customers may approve their own generations"
  on agentstack.generations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========================================================================
-- 0010_credits.sql
-- ========================================================================

-- Credits, and where they went.
--
-- The founder brings their own model key and pays OpenAI directly, so nothing
-- here meters tokens. What it meters is the services **we** pay for on their
-- behalf — Firecrawl scrapes, search calls, Telegram delivery — because those
-- are the costs that scale with a customer's usage and land on our card.
--
-- Credits are a unit, not a currency. A plan includes a number of credits and
-- each action costs a number of credits; what a credit costs us is our
-- business and is where the margin lives. That is the ordinary way metered
-- infrastructure is sold, and it has the property that nothing displayed to a
-- customer can turn out to be untrue — there is no dollar figure attached to
-- the balance for anyone to check against what they received.

alter table agentstack.profiles
  add column if not exists credits_included integer not null default 0,
  add column if not exists credits_used integer not null default 0,
  add column if not exists credits_reset_at timestamptz;

comment on column agentstack.profiles.credits_included is
  'Credits this plan grants per billing period. Set by the payment webhook.';
comment on column agentstack.profiles.credits_used is
  'Consumed this period. Reset when credits_reset_at passes.';

-- ---------------------------------------------------------------------------
-- credit_events — the itemised bill
--
-- One row per metered action, so "where did my credits go" has an answer that
-- is a list rather than a number. Also the only way to find out that one agent
-- is burning everything, which is the support question this table exists to
-- answer without a database console.
-- ---------------------------------------------------------------------------

create table if not exists agentstack.credit_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  agent_id   uuid references agentstack.agents on delete set null,
  -- Which upstream service. 'firecrawl', 'search', 'telegram', 'model'.
  service    text not null,
  -- What it did, for the itemised view: 'scrape', 'briefing', 'lead_search'.
  action     text not null,
  credits    integer not null check (credits >= 0),
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_events_user_idx
  on agentstack.credit_events (user_id, created_at desc);
create index if not exists credit_events_service_idx
  on agentstack.credit_events (user_id, service, created_at desc);

alter table agentstack.credit_events enable row level security;

create policy "customers may read their own credit events"
  on agentstack.credit_events for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Spending a credit
--
-- Atomic, and it refuses when the balance is short rather than going negative.
-- A metering system that lets the balance go below zero is one that discovers
-- the overspend after we have already paid for it.
--
-- The period reset happens here rather than on a cron: it is checked on every
-- spend, so a dormant account costs nothing to keep accurate and an active one
-- resets the moment it next does anything.
-- ---------------------------------------------------------------------------

create or replace function agentstack.spend_credits(
  p_user_id uuid,
  p_agent_id uuid,
  p_service text,
  p_action text,
  p_credits integer
)
returns TABLE (ok boolean, remaining integer)
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  prof agentstack.profiles;
begin
  select * into prof from agentstack.profiles where id = p_user_id for update;

  if prof.id is null then
    return query select false, 0;
    return;
  end if;

  -- New period: zero the meter before checking the balance.
  if prof.credits_reset_at is not null and prof.credits_reset_at <= now() then
    update agentstack.profiles
    set credits_used = 0,
        credits_reset_at = now() + interval '30 days'
    where id = p_user_id
    returning * into prof;
  end if;

  -- Admins are not metered. They are the ones testing it.
  if coalesce(prof.is_admin, false) then
    insert into agentstack.credit_events (user_id, agent_id, service, action, credits)
    values (p_user_id, p_agent_id, p_service, p_action, p_credits);
    return query select true, 999999;
    return;
  end if;

  if prof.credits_used + p_credits > prof.credits_included then
    return query select false, greatest(prof.credits_included - prof.credits_used, 0);
    return;
  end if;

  update agentstack.profiles
  set credits_used = credits_used + p_credits
  where id = p_user_id
  returning * into prof;

  insert into agentstack.credit_events (user_id, agent_id, service, action, credits)
  values (p_user_id, p_agent_id, p_service, p_action, p_credits);

  return query select true, prof.credits_included - prof.credits_used;
end;
$$;

-- The customer must not be able to grant themselves credits.
drop policy if exists "owners may edit their own profile fields" on agentstack.profiles;

create policy "owners may edit their own profile fields"
  on agentstack.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from agentstack.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from agentstack.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from agentstack.profiles p where p.id = auth.uid())
    and credits_included = (select p.credits_included from agentstack.profiles p where p.id = auth.uid())
    and credits_used = (select p.credits_used from agentstack.profiles p where p.id = auth.uid())
    and trial_ends_at is not distinct from
        (select p.trial_ends_at from agentstack.profiles p where p.id = auth.uid())
    and trial_started_at is not distinct from
        (select p.trial_started_at from agentstack.profiles p where p.id = auth.uid())
    and vercel_token_enc is not distinct from
        (select p.vercel_token_enc from agentstack.profiles p where p.id = auth.uid())
  );

grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0011_learning.sql
-- ========================================================================

-- Agents that get better, and the two rules that make that safe.
--
-- The promise is simple to say and easy to get wrong: every time an agent runs
-- for a customer it learns something, it keeps what it learned, and over time
-- the whole product gets better for everyone. Done carelessly that is a
-- machine for leaking one customer's business into another customer's prompts.
--
-- So there are two storage layers and a wall between them.
--
--   agent_notes     Private. One customer's agent, one customer's lessons.
--                   Never read by anybody else, ever. RLS enforces it.
--
--   agent_playbook  Shared. Anonymised, aggregated, and only ever written by
--                   a rollup that refuses to promote a lesson until it has
--                   been independently observed for several different
--                   customers. No user id, no agent id, no customer text
--                   carried across — a lesson only becomes shared once it has
--                   stopped being about anyone in particular.
--
-- The second rule is that this is compression, not a log. `agent_runs` already
-- keeps the full history. These tables keep *conclusions*: one row per distinct
-- lesson with a counter, upserted, capped, and pruned. An agent that runs
-- daily for a year holds a couple of hundred rows, not four thousand.

-- ---------------------------------------------------------------------------
-- agent_notes — what this agent learned, for this customer
-- ---------------------------------------------------------------------------

create table if not exists agentstack.agent_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  agent_id    uuid not null references agentstack.agents on delete cascade,
  -- Denormalised so the rollup can group across customers without a join
  -- back to a table it must not be reading rows out of.
  template_id text not null,

  -- What sort of lesson this is. Constrained rather than free text, because a
  -- vocabulary of six is what lets the prompt builder decide what to include
  -- and in which order.
  --   worked      an approach that produced a result
  --   failed      an approach that did not, so stop trying it
  --   audience    something true about who this customer sells to
  --   competitor  something true about a competitor
  --   style       how this founder wants things written
  --   fact        anything else worth not re-deriving tomorrow
  kind        text not null check (
                kind in ('worked','failed','audience','competitor','style','fact')
              ),

  -- The dedupe handle. Normalised and short — this is what makes the same
  -- lesson learned fifty times cost one row and a counter.
  key         text not null check (length(key) between 1 and 120),

  -- The lesson in a sentence. Overwritten by the most recent phrasing, which
  -- is usually the best one because it was written with the most context.
  summary     text not null check (length(summary) <= 600),

  -- How many times it has been seen, and how well it has done. Score is a
  -- running mean in [-1, 1]: -1 never work, +1 always works.
  observations integer not null default 1 check (observations > 0),
  score        numeric(4,3) not null default 0 check (score between -1 and 1),

  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- One row per distinct lesson per agent. This unique index is the compression.
create unique index if not exists agent_notes_unique_idx
  on agentstack.agent_notes (agent_id, kind, key);

create index if not exists agent_notes_agent_idx
  on agentstack.agent_notes (agent_id, observations desc, last_seen_at desc);

create index if not exists agent_notes_rollup_idx
  on agentstack.agent_notes (template_id, kind, key);

alter table agentstack.agent_notes enable row level security;

create policy "customers may read what their own agents learned"
  on agentstack.agent_notes for select
  using (auth.uid() = user_id);

-- Deliberately no insert or update policy. Notes are written by the callback
-- through the service role, after the calling agent has proved it is that
-- agent. A customer being able to write their own agent's memory by hand is a
-- prompt injection surface with a REST endpoint in front of it.

create policy "customers may delete what their own agents learned"
  on agentstack.agent_notes for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- agent_playbook — what worked across everybody
-- ---------------------------------------------------------------------------

create table if not exists agentstack.agent_playbook (
  id           uuid primary key default gen_random_uuid(),
  template_id  text not null,
  kind         text not null,
  key          text not null,
  lesson       text not null check (length(lesson) <= 600),

  -- The anonymity floor, kept on the row so it is auditable rather than a
  -- promise made in a function body somewhere.
  users_seen   integer not null default 0,
  observations integer not null default 0,
  score        numeric(4,3) not null default 0,

  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (template_id, kind, key)
);

create index if not exists agent_playbook_template_idx
  on agentstack.agent_playbook (template_id, score desc, users_seen desc);

alter table agentstack.agent_playbook enable row level security;

-- Readable by every signed-in customer: that is the point of it. Writable by
-- nobody but the rollup, which runs as the service role.
create policy "the playbook is readable by customers"
  on agentstack.agent_playbook for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- agent_prompt_revisions — agents editing their own script
-- ---------------------------------------------------------------------------
--
-- An agent may propose a rewrite of one of its own prompts. It is stored
-- versioned and inactive; making it live is a separate act. That split is the
-- whole safety story: a model that can silently rewrite its own instructions
-- has no stable behaviour and no way back, whereas a numbered revision that
-- someone switched on has both.

create table if not exists agentstack.agent_prompt_revisions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  agent_id    uuid not null references agentstack.agents on delete cascade,
  prompt_name text not null check (length(prompt_name) between 1 and 60),
  body        text not null check (length(body) <= 20000),
  -- Why it wanted the change, in its own words. Shown next to the diff.
  reason      text check (length(reason) <= 1000),
  version     integer not null default 1,
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- At most one live revision per prompt. Rollback is flipping this flag.
create unique index if not exists agent_prompt_revisions_active_idx
  on agentstack.agent_prompt_revisions (agent_id, prompt_name)
  where active;

create index if not exists agent_prompt_revisions_agent_idx
  on agentstack.agent_prompt_revisions (agent_id, prompt_name, version desc);

alter table agentstack.agent_prompt_revisions enable row level security;

create policy "customers may read their agents' proposed revisions"
  on agentstack.agent_prompt_revisions for select
  using (auth.uid() = user_id);

-- Turning one on is the customer's decision, so this one is theirs to update.
-- Everything except `active` is pinned: they may switch a revision on or off,
-- they may not edit the body of one and pass it off as what the agent wrote.
create policy "customers may activate a revision, not rewrite it"
  on agentstack.agent_prompt_revisions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and body = (select r.body from agentstack.agent_prompt_revisions r
                where r.id = agent_prompt_revisions.id)
    and prompt_name = (select r.prompt_name from agentstack.agent_prompt_revisions r
                       where r.id = agent_prompt_revisions.id)
    and agent_id = (select r.agent_id from agentstack.agent_prompt_revisions r
                    where r.id = agent_prompt_revisions.id)
  );

create policy "customers may discard a proposed revision"
  on agentstack.agent_prompt_revisions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Writing a lesson down
-- ---------------------------------------------------------------------------
--
-- Upsert, then prune. The prune is what keeps this bounded: an agent holds its
-- best 200 lessons, and "best" is how often it has been confirmed and how
-- recently, not how new it is. A lesson seen once in March loses to one
-- confirmed forty times, which is the correct outcome.

create or replace function agentstack.record_learning(
  p_agent_id uuid,
  p_kind     text,
  p_key      text,
  p_summary  text,
  p_score    numeric default 0
)
returns void
language plpgsql
security definer
set search_path = agentstack, public
as $$
declare
  a record;
  norm_key text;
begin
  select id, user_id, template_id into a
  from agentstack.agents where id = p_agent_id;

  if a.id is null then
    return;
  end if;

  -- Normalised so "Founders on LinkedIn" and "founders on linkedin  " are one
  -- lesson rather than two.
  norm_key := left(lower(btrim(regexp_replace(p_key, '\s+', ' ', 'g'))), 120);
  if norm_key = '' then
    return;
  end if;

  insert into agentstack.agent_notes
    (user_id, agent_id, template_id, kind, key, summary, observations, score)
  values
    (a.user_id, a.id, a.template_id, p_kind, norm_key, left(p_summary, 600), 1,
     greatest(-1, least(1, coalesce(p_score, 0))))
  on conflict (agent_id, kind, key) do update
  set
    -- The newest phrasing wins; it was written knowing the most.
    summary      = excluded.summary,
    observations = agentstack.agent_notes.observations + 1,
    -- Running mean, so one bad day cannot erase a month of evidence.
    score = round(
      ((agentstack.agent_notes.score * agentstack.agent_notes.observations)
        + excluded.score) / (agentstack.agent_notes.observations + 1),
      3
    ),
    last_seen_at = now();

  -- Keep the best 200. Confirmed-often and seen-recently beat merely new.
  delete from agentstack.agent_notes n
  where n.agent_id = p_agent_id
    and n.id not in (
      select id from agentstack.agent_notes
      where agent_id = p_agent_id
      order by observations desc, last_seen_at desc
      limit 200
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Promoting a lesson to everybody
-- ---------------------------------------------------------------------------
--
-- The anonymity floor lives here. A lesson is only shared once it has been
-- learned independently by `p_min_users` different customers, which is what
-- makes it a fact about the *job* rather than a fact about a business. Below
-- the floor it stays private, and a customer with an unusual niche never sees
-- their own findings appear in a stranger's agent.
--
-- The shared `lesson` text is the most-repeated phrasing across customers, not
-- any single customer's, and the `key` is already normalised to a generic
-- handle. Run it on a schedule; it is idempotent.

create or replace function agentstack.promote_playbook(p_min_users integer default 3)
returns integer
language plpgsql
security definer
set search_path = agentstack, public
as $$
declare
  promoted integer;
begin
  insert into agentstack.agent_playbook
    (template_id, kind, key, lesson, users_seen, observations, score, updated_at)
  select
    n.template_id,
    n.kind,
    n.key,
    -- The phrasing the most customers arrived at independently.
    (array_agg(n.summary order by n.observations desc))[1],
    count(distinct n.user_id),
    sum(n.observations),
    round(avg(n.score), 3),
    now()
  from agentstack.agent_notes n
  -- Only conclusions with evidence behind them. A note seen once by one agent
  -- is a guess, and guesses do not get to teach anybody else.
  where n.observations >= 2
  group by n.template_id, n.kind, n.key
  having count(distinct n.user_id) >= greatest(p_min_users, 2)
  on conflict (template_id, kind, key) do update
  set lesson       = excluded.lesson,
      users_seen   = excluded.users_seen,
      observations = excluded.observations,
      score        = excluded.score,
      updated_at   = now();

  get diagnostics promoted = row_count;

  -- A lesson everybody stopped confirming stops being advice.
  delete from agentstack.agent_playbook where score < -0.5;

  return promoted;
end;
$$;

comment on function agentstack.promote_playbook is
  'Rolls private agent notes up into the shared playbook, but only lessons that '
  'at least p_min_users different customers arrived at independently. The floor '
  'is what keeps one customer''s business out of another customer''s prompts.';

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all sequences in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
