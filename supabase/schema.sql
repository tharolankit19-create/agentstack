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

-- ========================================================================
-- 0012_scheduled_tasks.sql
-- ========================================================================

-- Timed instructions: "at 5pm, write the launch post and message me".
--
-- The founder tells the head agent to do something later, and it actually does
-- it later. That needs somewhere to remember the instruction between now and
-- then — this table — and a cron that wakes up, finds what is due, does it, and
-- messages the result. Nothing here runs the task; it only holds it.
--
-- Deliberately small. One row is one thing to do at one time. Recurring tasks,
-- dependencies and calendars are all things this is not — a founder saying "5pm"
-- wants one message at 5pm, not a scheduling engine.

create table if not exists agentstack.scheduled_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- Which agent should carry it out. Usually the head agent.
  agent_id    uuid references agentstack.agents on delete set null,

  -- What to do, in the founder's own words.
  instruction text not null check (length(instruction) between 1 and 2000),
  -- When, in UTC. The parser converts the founder's local time using their
  -- head agent's timezone.
  run_at      timestamptz not null,
  -- How it was said, for the confirmation and the reminder ("at 5pm").
  when_label  text,

  status      text not null default 'pending'
              check (status in ('pending', 'done', 'failed', 'cancelled')),
  -- What the agent produced when it ran, so the dashboard can show it too.
  result      text,
  error       text,

  created_at  timestamptz not null default now(),
  ran_at      timestamptz
);

-- The cron's query: what is due and still pending, oldest first.
create index if not exists scheduled_tasks_due_idx
  on agentstack.scheduled_tasks (status, run_at)
  where status = 'pending';

create index if not exists scheduled_tasks_user_idx
  on agentstack.scheduled_tasks (user_id, created_at desc);

alter table agentstack.scheduled_tasks enable row level security;

-- The founder sees their own scheduled tasks on the dashboard.
create policy "owners read their scheduled tasks"
  on agentstack.scheduled_tasks for select
  using (auth.uid() = user_id);

-- And may cancel one. Everything else is written by the service role: the
-- webhook creates them after the founder asks, the cron runs them. A customer
-- inserting arbitrary run_at rows is a way to make the platform do work on a
-- schedule they chose, so creation stays server-side.
create policy "owners may cancel their scheduled tasks"
  on agentstack.scheduled_tasks for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- Only the status may move, and only to cancelled.
    and instruction = (select t.instruction from agentstack.scheduled_tasks t
                       where t.id = scheduled_tasks.id)
    and run_at = (select t.run_at from agentstack.scheduled_tasks t
                  where t.id = scheduled_tasks.id)
  );

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0013_user_connectors.sql
-- ========================================================================

-- Connectors: the founder's own keys to the outside world, in one place.
--
-- The army can reach further when the founder plugs in a few keys of their own —
-- Firecrawl so the research squad reads live pages, X (via Xquik) so it watches
-- and posts, Apollo so outreach finds real people, Resend so email actually
-- sends. Asking for these one agent at a time is friction; this is the one
-- place they live, encrypted, and every consumer reads from here.
--
-- One row per founder. All the keys ride inside a single AES-256-GCM envelope
-- (`ciphertext`) exactly like agent_secrets — a database dump yields nothing.
-- `keys` lists which connector ids are set, so the dashboard can show what is
-- connected without ever decrypting, and the browser never touches ciphertext:
-- the app reads and writes it through the service role only.

create table if not exists agentstack.user_connectors (
  user_id     uuid primary key references auth.users on delete cascade,
  -- The sealed map of connector-id -> key. Never sent to a browser.
  ciphertext  text not null,
  -- Which connectors have a key on file. Display-only, safe to read.
  keys        text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table agentstack.user_connectors enable row level security;

-- The founder may see which connectors they have wired. The ciphertext column
-- exists on the row but the app never selects it client-side; even if it did,
-- it is encrypted with a key that lives only in the platform environment.
create policy "owners read their connectors"
  on agentstack.user_connectors for select
  using (auth.uid() = user_id);

-- Everything else is written by the service role: the connectors API opens the
-- envelope, merges the new key in, and re-seals it. A customer writing
-- ciphertext directly is a customer writing arbitrary bytes into a field the
-- deploy pipeline decrypts, so writes stay server-side.

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0014_agent_activity.sql
-- ========================================================================

-- Live activity: which agent is working right now.
--
-- The dashboard wants to show the founder their army in motion — "the research
-- agent is digging, the writer is drafting, the head agent is holding it all
-- together" — not a static roster. That needs a place to record work as it
-- starts, because the work itself is a fast server call that leaves no trace by
-- the time a dashboard poll arrives.
--
-- So each time an agent begins something, it drops a short-lived marker here
-- with a human label and an expiry a minute or two out. The dashboard reads the
-- unexpired ones and lights up exactly those agents, by name. Rows are tiny and
-- self-cleaning: anything past its expiry is ignored and periodically deleted.

create table if not exists agentstack.agent_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- The deployed agent, when there is one. Null for a squad role the head agent
  -- is orchestrating that the founder has not separately deployed.
  agent_id    uuid references agentstack.agents on delete set null,
  -- Always set — it is how the UI resolves the name and face.
  template_id text not null,
  -- What it is doing, in the founder's words: "digging up the latest for you".
  label       text not null check (length(label) between 1 and 200),
  started_at  timestamptz not null default now(),
  -- The dashboard shows this row only while now() < expires_at.
  expires_at  timestamptz not null
);

-- The dashboard's query: this founder's markers that are still live.
create index if not exists agent_activity_live_idx
  on agentstack.agent_activity (user_id, expires_at desc);

alter table agentstack.agent_activity enable row level security;

-- The founder sees their own army working. Everything is written by the service
-- role from inside the chat and cron paths — a customer inserting activity rows
-- would just be lighting up fake work on their own dashboard, so writes stay
-- server-side.
create policy "owners read their agent activity"
  on agentstack.agent_activity for select
  using (auth.uid() = user_id);

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0015_team_wiki.sql
-- ========================================================================

-- The team wiki: shared memory that outlives every agent.
--
-- The harness this product is missing. Agents had private notes and a
-- cross-customer playbook, and both tables sat empty — nothing ever wrote to
-- them — so every scheduled run started from zero. That is why the output read
-- as generic and why nothing compounded: the competitor agent is told to report
-- "what changed since last time" while having no record of a last time, and the
-- research agent is asked for "anything new" with no idea what is old.
--
-- This is the founder's cookbook. One shared, durable set of facts and
-- decisions about their business: what their market cares about, what a
-- competitor's pricing was on the day it was last checked, which angle worked
-- and which flopped. Every agent reads it before it works and writes back what
-- it learned, so the team gets sharper instead of repeating itself.
--
-- It belongs to the founder, not to any agent. Agents come and go; this stays.

create table if not exists agentstack.team_wiki (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,

  -- What kind of knowledge this is, so a reader can weight it.
  kind        text not null default 'fact'
              check (kind in ('fact','decision','worked','failed','competitor','audience','style')),

  -- A stable slug so the same lesson updates instead of duplicating. Two runs
  -- noticing the same competitor price should be one entry seen twice, not two.
  key         text not null check (length(key) between 1 and 120),

  title       text not null check (length(title) between 1 and 200),
  body        text not null check (length(body) between 1 and 4000),

  -- Which agent contributed it. Null once a human edits it.
  source_template text,

  -- How often the team has re-confirmed this. Rises on every repeat sighting.
  times_seen  int not null default 1,
  -- Founder-pinned entries always make it into the prompt.
  pinned      boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One entry per key per founder — this is what makes writes idempotent.
  unique (user_id, key)
);

create index if not exists team_wiki_user_idx
  on agentstack.team_wiki (user_id, pinned desc, updated_at desc);

alter table agentstack.team_wiki enable row level security;

-- The founder owns the cookbook: they can read it, correct it, and delete what
-- is wrong. Agents write through the service role, because an agent that can
-- rewrite the shared truth unreviewed is how one bad run poisons every future
-- one.
create policy "owners read their wiki"
  on agentstack.team_wiki for select
  using (auth.uid() = user_id);

create policy "owners edit their wiki"
  on agentstack.team_wiki for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners delete their wiki"
  on agentstack.team_wiki for delete
  using (auth.uid() = user_id);

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0016_heartbeat.sql
-- ========================================================================

-- The clock the army runs on.
--
-- Every scheduled promise in this product — the morning briefing, the research
-- pulse, "at 5pm do X", the squads doing today's job — is an endpoint that does
-- its work correctly and waits to be called. This table is what makes calling
-- them reliable: one row per worker, holding the last time it took its turn.
--
-- Keeping the schedule in the database rather than in the caller is what lets
-- the heartbeat be dumb. An outside scheduler only has to hit one URL often;
-- which workers are actually due is decided here, against real timestamps. If
-- the heartbeat is late, or missed a night entirely, the next tick still finds
-- everything overdue and runs it — where a wall-clock schedule would skip the
-- slot and wait for tomorrow.

create table if not exists agentstack.cron_ticks (
  worker text primary key,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The five workers, seeded so the first heartbeat after deploy has rows to
-- claim. `last_run_at` null means "overdue" — so everything runs on the very
-- first tick, and the army starts working the moment the schedule is wired up
-- rather than one full interval later.
insert into agentstack.cron_ticks (worker, last_run_at)
values
  ('tasks', null),
  ('agents', null),
  ('pipeline', null),
  ('briefing', null),
  ('research', null),
  ('playbook', null)
on conflict (worker) do nothing;

alter table agentstack.cron_ticks enable row level security;

-- RLS on, no policies, on purpose. This table is scheduling machinery, not
-- customer data: nobody signed in has any reason to read it, and anyone able to
-- write it could stall every founder's briefing by dating a tick into the
-- future. Service role only, which is what the heartbeat route uses.

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0017_internal_scheduler.sql
-- ========================================================================

-- The clock, moved inside the database.
--
-- The heartbeat works and has always worked; what kept failing was getting
-- anything to call it. GitHub Actions needs a repository secret set by hand.
-- Vercel Cron runs once a day on Hobby, which is not a schedule a briefing can
-- live on. Both are outside the product, and both were left unconfigured, so
-- the army sat still while every part of it reported healthy.
--
-- Postgres can call a URL on a schedule by itself. pg_cron holds the schedule,
-- pg_net makes the request, and both live in the Supabase project this app
-- already requires — so the scheduler has no dependency the product did not
-- already have, and no step a founder can forget in a different console.
--
-- The bearer token is generated here rather than configured. That is the part
-- that removes the last manual step: nothing has to agree with an environment
-- variable, because the app reads the same row this scheduler signs with. Note
-- what is NOT stored here — the app's `SECRETS_ENCRYPTION_KEY`, which protects
-- customer API keys in this same database, stays in the server environment
-- where it belongs. This secret only authorises cron endpoints. Putting the
-- lock and its key in one box would be a bad trade; putting a doorbell button
-- in the box is not.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One row, enforced by the primary key: `id` can only ever be true.
create table if not exists agentstack.scheduler_config (
  id boolean primary key default true check (id),
  -- Where the app lives. The one thing an operator must set.
  app_url text,
  -- What the scheduler signs its calls with. Generated once, never rotated
  -- automatically — a rotation mid-flight would lock out the running jobs.
  secret text not null default encode(gen_random_bytes(32), 'hex'),
  -- Written on every beat, so "is the scheduler alive" is answerable from SQL
  -- alone, without waiting to see whether the app noticed.
  last_beat_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into agentstack.scheduler_config (id) values (true)
on conflict (id) do nothing;

alter table agentstack.scheduler_config enable row level security;
-- RLS on, no policies: this row holds a bearer token. Service role only.

/**
 * One beat: call the app's heartbeat with the token from the row above.
 *
 * Returns quietly when `app_url` is unset rather than raising, because this
 * runs from a cron job — an exception here would be logged where nobody looks,
 * every five minutes, forever. An unconfigured scheduler should be silent and
 * visible (`last_beat_at` stays null), not noisy and ignored.
 */
create or replace function agentstack.beat()
returns void
language plpgsql
security definer
set search_path = agentstack, extensions, net, public
as $$
declare
  cfg agentstack.scheduler_config%rowtype;
begin
  select * into cfg from agentstack.scheduler_config where id;

  if cfg.app_url is null or length(trim(cfg.app_url)) = 0 then
    return;
  end if;

  perform net.http_get(
    url := rtrim(cfg.app_url, '/') || '/api/cron/heartbeat',
    headers := jsonb_build_object('Authorization', 'Bearer ' || cfg.secret),
    -- Fire and forget. The heartbeat claims each worker's turn and dispatches
    -- it in its own invocation, so this call returns long before the work does
    -- and must never hold a database worker waiting on it.
    timeout_milliseconds := 15000
  );

  update agentstack.scheduler_config set last_beat_at = now() where id;
end;
$$;

-- Schedule it. Wrapped because a project without pg_cron privileges should get
-- a working app and a clear note, not a failed paste of the whole schema.
do $$
begin
  perform cron.unschedule('agentstack-heartbeat');
exception when others then
  null;  -- Not scheduled yet, which is the normal first-run case.
end;
$$;

do $$
begin
  perform cron.schedule('agentstack-heartbeat', '*/5 * * * *', 'select agentstack.beat()');
  raise notice 'AgentStack: internal scheduler is on, every 5 minutes.';
exception when others then
  raise warning 'AgentStack: could not schedule the heartbeat (%). Enable pg_cron under Database -> Extensions, then re-run this migration.', sqlerrm;
end;
$$;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0018_leads_pipeline.sql
-- ========================================================================

-- The pipeline the outreach squad actually passes work along.
--
-- Until now each agent produced a draft and stopped. The lead agent wrote about
-- leads, the filter wrote about filtering, the outreach writer wrote a sample
-- email — three descriptions of a process rather than the process. Nothing was
-- handed from one agent to the next, because there was nowhere to hand it.
--
-- This is that place. One row per person, moving through named stages, each
-- stage owned by exactly one agent. A lead is found, then qualified, then given
-- an address, then written to, then sent. Every transition is durable, so a run
-- that dies halfway costs one lead's progress rather than the batch, and the
-- next tick picks up wherever the last one stopped.
--
-- Storing people carries an obligation, so two things are deliberate: a lead is
-- only ever business contact data the founder could have found themselves, and
-- deleting the founder deletes every lead with them (`on delete cascade`).

create type agentstack.lead_stage as enum (
  'found',      -- the lead agent produced it; nothing has judged it yet
  'qualified',  -- the filter kept it, with a reason and a score
  'rejected',   -- the filter dropped it, with a reason — kept, not deleted
  'enriched',   -- an address was found for it
  'written',    -- a personalised email exists, waiting for the founder
  'approved',   -- the founder said yes
  'sent',       -- it actually went out
  'failed'      -- something broke; `error` says what
);

create table if not exists agentstack.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  stage agentstack.lead_stage not null default 'found',

  -- Who they are. Everything nullable: a lead the source only half-knows is
  -- still worth qualifying, and demanding a full row would throw away most of
  -- what any real search returns.
  full_name text,
  title text,
  company text,
  company_domain text,
  location text,
  linkedin_url text,
  email text,

  -- Why this row exists at all, in the filter's words. Shown to the founder
  -- next to the lead, so a list they did not build is still a list they can
  -- judge.
  qualify_reason text,
  qualify_score int,

  -- The reason to write now rather than ever — a raise, a hire, a launch.
  -- Null is honest and common; an invented one is the failure mode this names.
  trigger text,

  -- The email, once written. Subject and body kept apart so the sender does not
  -- have to parse them back out of one blob.
  email_subject text,
  email_body text,

  -- Provenance. Which Monid endpoint produced this, and what the run cost.
  source text,
  cost numeric(12, 6) not null default 0,

  error text,

  -- The natural key: the same person must not enter the pipeline twice.
  -- Email when known, else the LinkedIn URL, else name+company.
  dedupe_key text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,

  unique (user_id, dedupe_key)
);

-- The query every stage worker runs: this founder's leads at one stage, oldest
-- first, so nothing starves behind a newer arrival.
create index if not exists leads_stage_idx
  on agentstack.leads (user_id, stage, created_at);

-- "What went out today", for the digest and the daily send cap.
create index if not exists leads_sent_idx
  on agentstack.leads (user_id, sent_at desc)
  where sent_at is not null;

alter table agentstack.leads enable row level security;

-- The founder owns their pipeline: they read it, correct a wrong address, and
-- delete anyone they should not have. Agents write through the service role —
-- a browser session that could move a lead to 'approved' would let the UI skip
-- the approval it exists to collect.
create policy "owners read their leads"
  on agentstack.leads for select
  using (auth.uid() = user_id);

create policy "owners edit their leads"
  on agentstack.leads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners delete their leads"
  on agentstack.leads for delete
  using (auth.uid() = user_id);

/**
 * How many emails this founder has sent today, in their own timezone.
 *
 * The send cap is the difference between cold outreach and spam, and it has to
 * be counted against the founder's day rather than UTC's — a cap that resets at
 * 5:30am local is one that quietly allows a double batch every morning.
 */
create or replace function agentstack.sent_today(p_user_id uuid, p_timezone text default 'UTC')
returns int
language sql
stable
as $$
  select count(*)::int
    from agentstack.leads
   where user_id = p_user_id
     and sent_at is not null
     and (sent_at at time zone p_timezone)::date = (now() at time zone p_timezone)::date;
$$;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- The pipeline worker needs a tick row of its own. Seeded null so it is overdue
-- immediately and starts on the first heartbeat after this migration, rather
-- than one full interval later.
insert into agentstack.cron_ticks (worker, last_run_at)
values ('pipeline', null)
on conflict (worker) do nothing;

-- ========================================================================
-- 0019_pay_as_you_go.sql
-- ========================================================================

-- Credits you buy, not a plan you are on.
--
-- The subscription model asked a founder to commit monthly before they had seen
-- the product produce anything, and it punished the two ends of the range: a
-- quiet month still cost $29, and a heavy one hit a cap. Neither matches how
-- this product is actually used — a founder pushes hard for a launch week and
-- coasts after it.
--
-- So credits are bought in packs and spent per action. A balance that does not
-- expire, no monthly commitment, and the founder decides how hard to run.
--
-- Credits are a unit, not a currency. What a credit costs us is our business
-- and is where the margin lives; what it buys is stated plainly per action.
-- That is the ordinary way metered infrastructure is sold, and it has the
-- property that nothing shown to a customer can turn out to be untrue.

alter table agentstack.profiles
  -- Bought and not yet spent. Survives the month, unlike the plan allowance
  -- this replaces — an expiring balance is a second deadline the founder did
  -- not ask for, and it makes the cheapest pack a trap rather than a trial.
  add column if not exists credit_balance integer not null default 0,
  -- Lifetime totals, for support and for the founder's own ledger.
  add column if not exists credits_purchased integer not null default 0,
  add column if not exists credits_spent integer not null default 0;

comment on column agentstack.profiles.credit_balance is
  'Credits bought and not yet spent. Never expires. The only gate on running agents.';

-- ---------------------------------------------------------------------------
-- credit_purchases — what they bought, and what we were paid
-- ---------------------------------------------------------------------------
create table if not exists agentstack.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  credits integer not null check (credits > 0),
  -- What they actually paid, in cents, as reported by the payment provider —
  -- never computed here. A price we recalculate is a price that can disagree
  -- with the receipt, and the receipt is the one the customer has.
  paid_cents integer not null check (paid_cents >= 0),
  -- The provider's own id, so a webhook delivered twice credits once.
  provider_ref text unique,
  created_at timestamptz not null default now()
);

create index if not exists credit_purchases_user_idx
  on agentstack.credit_purchases (user_id, created_at desc);

alter table agentstack.credit_purchases enable row level security;

create policy "owners read their purchases"
  on agentstack.credit_purchases for select
  using (auth.uid() = user_id);

/**
 * Spend credits, or refuse.
 *
 * Atomic and conditional: the update only matches a row that still has enough,
 * so two agents spending the last credits at the same instant cannot both
 * succeed. Returns the new balance, or -1 when there was not enough — a caller
 * that gets -1 must not do the work.
 *
 * Balance is checked and decremented in one statement on purpose. Read-then-write
 * would leave a window where a founder on their last credits pays for one action
 * and receives two.
 */
create or replace function agentstack.spend_credits(
  p_user_id uuid,
  p_credits integer,
  p_service text,
  p_action text,
  p_agent_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = agentstack, public
as $$
declare
  remaining integer;
begin
  if p_credits <= 0 then
    select credit_balance into remaining from agentstack.profiles where id = p_user_id;
    return coalesce(remaining, 0);
  end if;

  update agentstack.profiles
     set credit_balance = credit_balance - p_credits,
         credits_spent = credits_spent + p_credits
   where id = p_user_id
     and credit_balance >= p_credits
  returning credit_balance into remaining;

  if remaining is null then
    return -1;
  end if;

  insert into agentstack.credit_events (user_id, agent_id, service, action, credits)
  values (p_user_id, p_agent_id, p_service, p_action, p_credits);

  return remaining;
end;
$$;

/** Add credits after a confirmed payment. Idempotent on the provider's id. */
create or replace function agentstack.add_credits(
  p_user_id uuid,
  p_credits integer,
  p_paid_cents integer,
  p_provider_ref text
)
returns integer
language plpgsql
security definer
set search_path = agentstack, public
as $$
declare
  new_balance integer;
begin
  -- A webhook delivered twice must credit once. The unique constraint on
  -- provider_ref is what enforces it; this just makes the second call a no-op
  -- rather than an error the provider will retry forever.
  insert into agentstack.credit_purchases (user_id, credits, paid_cents, provider_ref)
  values (p_user_id, p_credits, p_paid_cents, p_provider_ref)
  on conflict (provider_ref) do nothing;

  if not found then
    select credit_balance into new_balance from agentstack.profiles where id = p_user_id;
    return coalesce(new_balance, 0);
  end if;

  update agentstack.profiles
     set credit_balance = credit_balance + p_credits,
         credits_purchased = credits_purchased + p_credits
   where id = p_user_id
  returning credit_balance into new_balance;

  return coalesce(new_balance, 0);
end;
$$;

/**
 * Free credits on signup.
 *
 * Enough to see the product actually work — a lead search, a few pages read, a
 * briefing — because the argument this product has to win is "it does the
 * thing", and no amount of copy wins it as well as one real morning briefing.
 */
alter table agentstack.profiles
  alter column credit_balance set default 500;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0020_room.sql
-- ========================================================================

-- The room.
--
-- The squads have always worked in isolation: each agent runs, files what it
-- produced, and never sees what anyone else did. The head agent reads all of it
-- afterwards and summarises — which is coordination after the fact, and by then
-- the SEO agent has already written a post about a competitor claim the
-- competitor agent disproved that morning.
--
-- A room is one shared thread per founder. Agents post what they found when it
-- is worth another agent knowing, the head agent directs, and the founder can
-- read it or step in and @mention anyone. Nobody is autonomous here — an agent
-- speaks when it has just done work, never in a loop with another agent, which
-- is the failure mode that turns multi-agent chat into two machines talking to
-- each other until the budget runs out.

create table if not exists agentstack.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Who spoke. Null author means the founder — they are a person, not an agent,
  -- and giving them a fake agent row to satisfy a foreign key would put them in
  -- every "which agents are active" count.
  agent_id uuid references agentstack.agents (id) on delete set null,
  template_id text,

  body text not null,

  -- Who this was addressed to, when it was addressed to anyone. Drives the
  -- unread badge on an agent, and stops a broadcast from waking all thirteen.
  mentions text[] not null default '{}',

  -- What prompted it, so a line in the room can be opened.
  generation_id uuid references agentstack.generations (id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists room_messages_user_idx
  on agentstack.room_messages (user_id, created_at desc);

alter table agentstack.room_messages enable row level security;

-- The founder reads their own room and can post into it. Agents write through
-- the service role: a browser session that could post as an agent could put
-- words in a squad member's mouth, and the whole value of the room is that what
-- an agent says there is what it actually did.
create policy "owners read their room"
  on agentstack.room_messages for select
  using (auth.uid() = user_id);

create policy "owners speak in their room"
  on agentstack.room_messages for insert
  with check (auth.uid() = user_id and agent_id is null);

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0021_kryx_founder_os.sql
-- ========================================================================

-- KryxAI founder OS foundation.
-- Adds only durable product state that does not already live in agents,
-- generations, leads, scheduled_tasks, room_messages or chat_messages.

create table if not exists agentstack.connected_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'github' check (provider in ('github')),
  repo_full_name text not null,
  repo_url text not null,
  default_branch text not null default 'main',
  installation_id text,
  seo_root text not null default '/',
  can_write boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, repo_full_name)
);

create table if not exists agentstack.seo_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_id uuid references agentstack.connected_repositories(id) on delete set null,
  agent_id uuid references agentstack.agents(id) on delete set null,
  status text not null default 'researched' check (status in ('researched','drafted','waiting_approval','approved','publishing','published','failed','rejected')),
  query text,
  search_intent text,
  slug text,
  title text,
  evidence jsonb not null default '[]'::jsonb,
  draft_path text,
  draft_content text,
  commit_sha text,
  published_url text,
  error text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agentstack.startup_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  window_start timestamptz,
  window_end timestamptz,
  visitors bigint,
  sessions bigint,
  signups bigint,
  activated_users bigint,
  paid_customers bigint,
  revenue_cents bigint,
  ad_spend_cents bigint,
  avg_session_seconds numeric,
  signup_conversion numeric,
  paid_conversion numeric,
  cac_cents bigint,
  ltv_cents bigint,
  source_breakdown jsonb not null default '{}'::jsonb,
  geo_breakdown jsonb not null default '{}'::jsonb,
  funnel jsonb not null default '{}'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  source_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agentstack.founder_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references agentstack.agents(id) on delete set null,
  kind text not null check (kind in ('diagnosis','trend','milestone','approval','briefing','system')),
  severity text not null default 'normal' check (severity in ('low','normal','high','urgent')),
  title text not null,
  body text not null,
  channel text not null default 'dashboard' check (channel in ('dashboard','telegram','voice')),
  dedupe_key text,
  meta jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists founder_notifications_dedupe_idx
  on agentstack.founder_notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists agentstack.agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_agent_id uuid references agentstack.agents(id) on delete set null,
  to_agent_id uuid references agentstack.agents(id) on delete set null,
  generation_id uuid references agentstack.generations(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','accepted','completed','blocked','cancelled')),
  needs_head_approval boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rich chat/voice/image support. Existing text chat remains valid.
alter table agentstack.chat_messages
  add column if not exists content_type text not null default 'text',
  add column if not exists media_url text,
  add column if not exists transcript text,
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists connected_repositories_user_idx
  on agentstack.connected_repositories(user_id, enabled);
create index if not exists seo_jobs_user_status_idx
  on agentstack.seo_jobs(user_id, status, created_at desc);
create index if not exists startup_health_user_time_idx
  on agentstack.startup_health_snapshots(user_id, captured_at desc);
create index if not exists founder_notifications_user_time_idx
  on agentstack.founder_notifications(user_id, created_at desc);
create index if not exists agent_handoffs_user_status_idx
  on agentstack.agent_handoffs(user_id, status, created_at desc);

alter table agentstack.connected_repositories enable row level security;
alter table agentstack.seo_jobs enable row level security;
alter table agentstack.startup_health_snapshots enable row level security;
alter table agentstack.founder_notifications enable row level security;
alter table agentstack.agent_handoffs enable row level security;

create policy "owners read connected repositories" on agentstack.connected_repositories
  for select using (auth.uid() = user_id);
create policy "owners manage connected repositories" on agentstack.connected_repositories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read seo jobs" on agentstack.seo_jobs
  for select using (auth.uid() = user_id);
create policy "owners manage seo approvals" on agentstack.seo_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read startup health" on agentstack.startup_health_snapshots
  for select using (auth.uid() = user_id);

create policy "owners read notifications" on agentstack.founder_notifications
  for select using (auth.uid() = user_id);
create policy "owners update notifications" on agentstack.founder_notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owners read handoffs" on agentstack.agent_handoffs
  for select using (auth.uid() = user_id);

-- Service-role workers insert operational state; authenticated founders mainly read
-- and approve. Existing project convention grants table access and relies on RLS.
grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;

-- ========================================================================
-- 0022_payg_credits.sql
-- ========================================================================

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

-- ========================================================================
-- 0023_signup_credit_grant.sql
-- ========================================================================

-- One-time signup credit grant.
--
-- 100 Kryx credits = $1 customer-facing. New profiles start with 100 credits
-- once; purchased credits still never expire. This migration deliberately does
-- not change plan, trial, quota, or subscription behavior.

alter table agentstack.profiles
  alter column credit_balance set default 100;

comment on column agentstack.profiles.credit_balance is
  'Prepaid Kryx credits. New profiles start with a one-time 100-credit starter grant; purchased credits never expire.';

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
    credit_balance
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    100
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ========================================================================
-- 0024_founder_feedback.sql
-- ========================================================================


-- Founder interviews. All writes use the server; rewards require admin review.
create table agentstack.feedback_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade unique,
 answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 6),
 usage_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','submitted','rewarded','rejected')),
 version integer not null default 0,
 review_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 improvement_status text not null default 'new' check (improvement_status in ('new','planned','working','shipped','not_planned')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 submitted_at timestamptz,
 reviewed_at timestamptz
);
create index feedback_review_queue on agentstack.feedback_sessions(status, updated_at desc);
alter table agentstack.feedback_sessions enable row level security;
create policy feedback_owner_read on agentstack.feedback_sessions for select to authenticated using (user_id = auth.uid());
revoke all on agentstack.feedback_sessions from anon, authenticated;
grant select on agentstack.feedback_sessions to authenticated;
grant all on agentstack.feedback_sessions to service_role;

create table agentstack.feedback_rewards (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null unique references agentstack.feedback_sessions(id) on delete cascade,
 credits integer not null default 200 check (credits = 200),
 granted_at timestamptz not null default now()
);
alter table agentstack.feedback_rewards enable row level security;
create policy feedback_reward_owner_read on agentstack.feedback_rewards for select to authenticated using (user_id = auth.uid());
revoke all on agentstack.feedback_rewards from anon, authenticated;
grant select on agentstack.feedback_rewards to authenticated;
grant all on agentstack.feedback_rewards to service_role;

create table agentstack.feedback_reviews (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references agentstack.feedback_sessions(id) on delete cascade,
 reviewer_id uuid references auth.users(id) on delete set null,
 decision text not null,
 note text not null,
 improvement_status text not null,
 created_at timestamptz not null default now()
);
alter table agentstack.feedback_reviews enable row level security;
revoke all on agentstack.feedback_reviews from public, anon, authenticated;
grant all on agentstack.feedback_reviews to service_role;

-- Row lock makes retries/concurrent approvals idempotent; the grant, wallet,
-- audit and decision either all commit or all roll back. No client reward amount.
create or replace function agentstack.review_founder_feedback(
 p_session_id uuid, p_reviewer uuid, p_decision text, p_note text, p_improvement text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s agentstack.feedback_sessions; n integer;
begin
 if not exists(select 1 from agentstack.profiles where id=p_reviewer and is_admin=true) then
  raise exception 'Admin required';
 end if;
 if p_decision not in ('approve','reject','triage') or p_decision is null then raise exception 'Invalid decision'; end if;
 if p_improvement not in ('new','planned','working','shipped','not_planned') or p_improvement is null then raise exception 'Invalid triage'; end if;
 if length(btrim(coalesce(p_note,''))) < 8 or length(p_note)>2000 then raise exception 'Explain the decision'; end if;
 select * into s from agentstack.feedback_sessions where id=p_session_id for update;
 if not found then raise exception 'Feedback not found'; end if;
 insert into agentstack.feedback_reviews(session_id,reviewer_id,decision,note,improvement_status)
 values(s.id,p_reviewer,p_decision,p_note,p_improvement);
 if p_decision='triage' then
  update agentstack.feedback_sessions set improvement_status=p_improvement, review_note=p_note,
   reviewed_by=p_reviewer, reviewed_at=now(), updated_at=now() where id=s.id;
  return jsonb_build_object('status',s.status,'credits',0);
 end if;
 if s.status='rewarded' then return jsonb_build_object('status','rewarded','credits',200); end if;
 if s.status not in ('submitted','rejected') then raise exception 'Submit the interview first'; end if;
 if p_decision='approve' then
  if jsonb_array_length(s.answers)<>6 then raise exception 'Incomplete interview'; end if;
  insert into agentstack.feedback_rewards(user_id, session_id) values(s.user_id,s.id) on conflict do nothing;
  get diagnostics n = row_count;
  if n=1 then
   update agentstack.profiles set credit_balance=credit_balance+200 where id=s.user_id;
   if not found then raise exception 'Wallet missing'; end if;
   insert into agentstack.credit_topups(user_id,credits,paid_cents,provider,provider_ref)
    values(s.user_id,200,0,'feedback',s.id::text);
  end if;
 end if;
 update agentstack.feedback_sessions set
  status=case when p_decision='approve' then 'rewarded' else 'rejected' end,
  review_note=p_note, reviewed_by=p_reviewer, reviewed_at=now(),
  improvement_status=p_improvement, updated_at=now() where id=s.id;
 return jsonb_build_object('status',case when p_decision='approve' then 'rewarded' else 'rejected' end,
  'credits',case when p_decision='approve' then 200 else 0 end);
end $$;
revoke all on function agentstack.review_founder_feedback(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function agentstack.review_founder_feedback(uuid,uuid,text,text,text) to service_role;

-- ========================================================================
-- 0025_payg_runtime_access.sql
-- ========================================================================

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

-- ========================================================================
-- 0026_dodo_credit_webhook_repair.sql
-- ========================================================================

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

-- ========================================================================
-- 0026_room_and_recurring_schedule.sql
-- ========================================================================

-- Repair Room storage and add founder-created recurring schedules.
--
-- Safe to run on databases that already have migrations 0012/0020: every table
-- and column creation is idempotent, and policies are recreated deliberately.

create table if not exists agentstack.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id uuid references agentstack.agents (id) on delete set null,
  template_id text,
  body text not null,
  mentions text[] not null default '{}',
  generation_id uuid references agentstack.generations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_user_idx
  on agentstack.room_messages (user_id, created_at desc);

alter table agentstack.room_messages enable row level security;
drop policy if exists "owners read their room" on agentstack.room_messages;
create policy "owners read their room"
  on agentstack.room_messages for select
  using (auth.uid() = user_id);
drop policy if exists "owners speak in their room" on agentstack.room_messages;
create policy "owners speak in their room"
  on agentstack.room_messages for insert
  with check (auth.uid() = user_id and agent_id is null);

create table if not exists agentstack.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  agent_id uuid references agentstack.agents on delete set null,
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
  on agentstack.scheduled_tasks (status, run_at)
  where status = 'pending';

create index if not exists scheduled_tasks_user_idx
  on agentstack.scheduled_tasks (user_id, created_at desc);

alter table agentstack.scheduled_tasks enable row level security;
drop policy if exists "owners read their scheduled tasks" on agentstack.scheduled_tasks;
create policy "owners read their scheduled tasks"
  on agentstack.scheduled_tasks for select
  using (auth.uid() = user_id);

-- Cancellation also goes through the authenticated server route. Keep direct
-- browser writes closed so a signed-in client cannot mutate run times,
-- recurrence or task ownership with the publishable Supabase key.
drop policy if exists "owners may cancel their scheduled tasks" on agentstack.scheduled_tasks;
revoke insert, update, delete on agentstack.scheduled_tasks from authenticated;

grant usage on schema agentstack to authenticated, service_role;
grant all on agentstack.room_messages to service_role;
grant select, insert on agentstack.room_messages to authenticated;
grant all on agentstack.scheduled_tasks to service_role;
grant select on agentstack.scheduled_tasks to authenticated;

-- ========================================================================
-- 0027_kryx_production_repair.sql
-- ========================================================================

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

-- ========================================================================
-- 0028_kryx_security_hardening.sql
-- ========================================================================

-- Kryx-only security hardening applied to production on 2026-09-15.
-- Does not touch public/Meamus application objects.

revoke all on function agentstack.enforce_agent_quota() from public, anon, authenticated;
revoke all on function agentstack.ensure_profile(uuid, text) from public, anon, authenticated;
revoke all on function agentstack.handle_new_user() from public, anon, authenticated;
revoke all on function agentstack.pause_agents_on_lapse() from public, anon, authenticated;
revoke all on function agentstack.pause_agents_on_trial_end() from public, anon, authenticated;
revoke all on function agentstack.promote_playbook(integer) from public, anon, authenticated;
revoke all on function agentstack.record_learning(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function agentstack.spend_credits(uuid, uuid, text, text, integer) from public, anon, authenticated;

grant execute on function agentstack.ensure_profile(uuid, text) to service_role;
grant execute on function agentstack.promote_playbook(integer) to service_role;
grant execute on function agentstack.record_learning(uuid, text, text, text, numeric) to service_role;
grant execute on function agentstack.spend_credits(uuid, uuid, text, text, integer) to service_role;
grant execute on function agentstack.add_credits(uuid, integer, integer, text) to service_role;

alter function agentstack.touch_updated_at() set search_path = agentstack, pg_temp;
alter function agentstack.is_entitled(agentstack.profiles) set search_path = agentstack, pg_temp;

revoke all on agentstack.agent_secrets from anon, authenticated;
revoke all on agentstack.webhook_events from anon, authenticated;
grant all on agentstack.agent_secrets to service_role;
grant all on agentstack.webhook_events to service_role;

notify pgrst, 'reload schema';

-- ========================================================================
-- 0029_desktop_devices.sql
-- ========================================================================

-- Kryx Desktop V1.2 — Phase 2: device identity and revocable sessions.
-- Additive only. Does not alter existing agents, missions, credits, billing or auth.
--
-- Device registration is performed by a server route after validating the
-- founder's Supabase access token. The plaintext device token is returned once,
-- stored in macOS Keychain, and never stored in Postgres.

create table if not exists agentstack.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 120),
  platform text not null check (platform in ('macos','windows','linux','android')),
  os_version text,
  app_version text,
  status text not null default 'offline'
    check (status in ('online','offline','revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  public_key text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, installation_id)
);

create index if not exists devices_user_status_idx
  on agentstack.devices(user_id, status, last_seen_at desc);

alter table agentstack.devices enable row level security;

drop policy if exists "owners read their devices" on agentstack.devices;
create policy "owners read their devices"
  on agentstack.devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Device writes go through server routes so revocation, token invalidation and
-- the audit trail cannot be bypassed with a direct REST call.
revoke insert, update, delete on agentstack.devices from anon, authenticated;
grant select on agentstack.devices to authenticated;
grant all on agentstack.devices to service_role;


create table if not exists agentstack.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  user_agent text
);

create index if not exists device_sessions_active_idx
  on agentstack.device_sessions(device_id, expires_at desc)
  where revoked_at is null;

create index if not exists device_sessions_user_idx
  on agentstack.device_sessions(user_id, created_at desc);

alter table agentstack.device_sessions enable row level security;

-- Token hashes are server-only. The dashboard does not need them to render the
-- Devices page.
revoke all on agentstack.device_sessions from public, anon, authenticated;
grant all on agentstack.device_sessions to service_role;


create table if not exists agentstack.device_auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  session_id uuid references agentstack.device_sessions(id) on delete set null,
  event text not null check (event in (
    'registered',
    'session_issued',
    'session_refreshed',
    'heartbeat',
    'renamed',
    'revoked',
    'auth_failed'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_auth_events_user_idx
  on agentstack.device_auth_events(user_id, created_at desc);

alter table agentstack.device_auth_events enable row level security;

drop policy if exists "owners read device auth events" on agentstack.device_auth_events;
create policy "owners read device auth events"
  on agentstack.device_auth_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on agentstack.device_auth_events from anon, authenticated;
grant select on agentstack.device_auth_events to authenticated;
grant all on agentstack.device_auth_events to service_role;


-- Revocation is intentionally atomic: once the device is marked revoked every
-- active device credential is invalidated in the same transaction.
create or replace function agentstack.revoke_device(
  p_user_id uuid,
  p_device_id uuid,
  p_reason text default 'user_revoked'
)
returns boolean
language plpgsql
security invoker
set search_path = agentstack, pg_temp
as $$
declare
  changed integer;
begin
  update agentstack.devices
  set status = 'revoked',
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where id = p_device_id
    and user_id = p_user_id
    and revoked_at is null;

  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;

  update agentstack.device_sessions
  set revoked_at = coalesce(revoked_at, now()),
      revoke_reason = coalesce(revoke_reason, p_reason)
  where device_id = p_device_id
    and user_id = p_user_id
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function agentstack.revoke_device(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function agentstack.revoke_device(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';

-- ========================================================================
-- 0030_desktop_pkce_auth.sql
-- ========================================================================

-- Kryx Desktop V1.2 — Phase 3: authorization-code + PKCE bridge.
--
-- The founder authenticates in the normal Kryx web app (including Google).
-- Desktop never receives a Google password or browser cookie. Approval produces
-- a one-time code bound to the desktop's PKCE verifier.

alter table agentstack.device_sessions
  add column if not exists refresh_token_hash text,
  add column if not exists refresh_expires_at timestamptz;

create index if not exists device_sessions_refresh_idx
  on agentstack.device_sessions(id, refresh_expires_at)
  where revoked_at is null;


create table if not exists agentstack.desktop_auth_requests (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 120),
  platform text not null check (platform in ('macos','windows','linux','android')),
  os_version text,
  app_version text,
  capabilities jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  public_key text,

  -- OAuth-style CSRF + PKCE values. State is safe to persist; it is not an
  -- authentication credential. The code itself is never persisted, only hash.
  state text not null check (char_length(state) between 24 and 256),
  code_challenge text not null check (char_length(code_challenge) between 43 and 128),
  redirect_uri text not null default 'kryx://auth/callback',

  user_id uuid references auth.users(id) on delete cascade,
  code_hash text check (code_hash is null or char_length(code_hash) = 64),
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists desktop_auth_requests_expiry_idx
  on agentstack.desktop_auth_requests(expires_at)
  where consumed_at is null;

alter table agentstack.desktop_auth_requests enable row level security;

-- These rows are part of the authorization protocol and never exposed through
-- PostgREST to browsers or desktop clients.
revoke all on agentstack.desktop_auth_requests from public, anon, authenticated;
grant all on agentstack.desktop_auth_requests to service_role;

notify pgrst, 'reload schema';

-- ========================================================================
-- 0031_hybrid_device_tasks.sql
-- ========================================================================

-- Kryx hybrid device execution — durable missions, approvals, evidence and dispatch.
-- Shared by macOS and Android. Additive only.

create table if not exists agentstack.hybrid_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_key text,
  instruction text not null check (char_length(instruction) between 1 and 4000),
  requested_execution text not null default 'auto'
    check (requested_execution in ('auto','cloud','macos','android')),
  selected_device_id uuid references agentstack.devices(id) on delete set null,
  status text not null default 'queued'
    check (status in (
      'queued','planning','running','waiting_for_device','waiting_for_user',
      'blocked','verifying','completed','failed','cancelled'
    )),
  planner jsonb not null default '{}'::jsonb,
  summary text,
  estimated_credits integer,
  credits_used integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists hybrid_missions_user_status_idx
  on agentstack.hybrid_missions(user_id, status, created_at desc);
create index if not exists hybrid_missions_device_idx
  on agentstack.hybrid_missions(selected_device_id, status, created_at)
  where selected_device_id is not null;

alter table agentstack.hybrid_missions enable row level security;
create policy "owners read hybrid missions"
  on agentstack.hybrid_missions for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.hybrid_missions from anon, authenticated;
grant select on agentstack.hybrid_missions to authenticated;
grant all on agentstack.hybrid_missions to service_role;


create table if not exists agentstack.hybrid_mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  agent_template_id text,
  label text not null check (char_length(label) between 1 and 240),
  execution text not null check (execution in ('cloud','device')),
  required_capabilities text[] not null default '{}',
  status text not null default 'queued'
    check (status in (
      'queued','running','waiting_for_device','waiting_for_user',
      'blocked','verifying','completed','failed','cancelled'
    )),
  depends_on uuid[] not null default '{}',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (mission_id, ordinal)
);

create index if not exists hybrid_steps_mission_idx
  on agentstack.hybrid_mission_steps(mission_id, ordinal);
create index if not exists hybrid_steps_status_idx
  on agentstack.hybrid_mission_steps(user_id, status, created_at);

alter table agentstack.hybrid_mission_steps enable row level security;
create policy "owners read hybrid mission steps"
  on agentstack.hybrid_mission_steps for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.hybrid_mission_steps from anon, authenticated;
grant select on agentstack.hybrid_mission_steps to authenticated;
grant all on agentstack.hybrid_mission_steps to service_role;


create table if not exists agentstack.device_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid not null references agentstack.hybrid_mission_steps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,

  task_type text not null,
  instruction text not null,
  payload jsonb not null default '{}'::jsonb,
  required_capabilities text[] not null default '{}',
  allowed_actions text[] not null default '{}',
  risk_level integer not null default 1 check (risk_level between 1 and 3),

  status text not null default 'queued'
    check (status in (
      'queued','claimed','running','waiting_for_user','blocked',
      'verifying','completed','failed','cancelled'
    )),
  nonce uuid not null default gen_random_uuid(),
  envelope_version integer not null default 1,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  attempt integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),

  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error_code text,
  error_message text,

  unique (nonce)
);

-- Earlier versions indexed created_at without declaring it. Preserve existing tasks.
alter table agentstack.device_tasks add column if not exists created_at timestamptz not null default now();

create index if not exists device_tasks_dispatch_idx
  on agentstack.device_tasks(device_id, status, created_at)
  where status in ('queued','claimed','running','waiting_for_user','blocked','verifying');
create index if not exists device_tasks_mission_idx
  on agentstack.device_tasks(mission_id, created_at);

alter table agentstack.device_tasks enable row level security;
revoke all on agentstack.device_tasks from public, anon, authenticated;
grant all on agentstack.device_tasks to service_role;


create table if not exists agentstack.action_approvals (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid references agentstack.hybrid_mission_steps(id) on delete cascade,
  task_id uuid references agentstack.device_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_by text not null default 'kryx',
  action_type text not null,
  target text,
  description text not null,
  preview jsonb not null default '{}'::jsonb,
  risk_level integer not null check (risk_level in (2,3)),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','cancelled')),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists action_approvals_user_pending_idx
  on agentstack.action_approvals(user_id, created_at desc)
  where status = 'pending';

alter table agentstack.action_approvals enable row level security;
create policy "owners read their action approvals"
  on agentstack.action_approvals for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.action_approvals from anon, authenticated;
grant select on agentstack.action_approvals to authenticated;
grant all on agentstack.action_approvals to service_role;


create table if not exists agentstack.task_evidence (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  step_id uuid references agentstack.hybrid_mission_steps(id) on delete cascade,
  task_id uuid references agentstack.device_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  kind text not null check (kind in (
    'source','fact','file','ui_receipt','action_receipt','metric','error','note'
  )),
  title text,
  source_url text,
  content jsonb not null default '{}'::jsonb,
  content_sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists task_evidence_mission_idx
  on agentstack.task_evidence(mission_id, created_at);

alter table agentstack.task_evidence enable row level security;
create policy "owners read their task evidence"
  on agentstack.task_evidence for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.task_evidence from anon, authenticated;
grant select on agentstack.task_evidence to authenticated;
grant all on agentstack.task_evidence to service_role;


create table if not exists agentstack.device_task_events (
  id bigserial primary key,
  task_id uuid not null references agentstack.device_tasks(id) on delete cascade,
  mission_id uuid not null references agentstack.hybrid_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  event_type text not null,
  state text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_task_events_task_idx
  on agentstack.device_task_events(task_id, created_at);

alter table agentstack.device_task_events enable row level security;
create policy "owners read their device task events"
  on agentstack.device_task_events for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.device_task_events from anon, authenticated;
grant select on agentstack.device_task_events to authenticated;
grant all on agentstack.device_task_events to service_role;

notify pgrst, 'reload schema';

-- ========================================================================
-- 0032_device_task_queue_ttl.sql
-- ========================================================================

-- Device queue durability: queued work can survive an offline/sleeping device.
-- The signed execution envelope itself is short-lived; the durable DB job is not.
alter table agentstack.device_tasks
  alter column expires_at set default (now() + interval '24 hours');

-- ========================================================================
-- 0033_device_scheduling_observer.sql
-- ========================================================================

-- Kryx hybrid scheduling + Observer foundation.
-- Additive extensions to the existing scheduler; existing cloud schedules remain unchanged.

alter table agentstack.scheduled_tasks
  add column if not exists execution_target text not null default 'cloud',
  add column if not exists device_id uuid references agentstack.devices(id) on delete set null;

alter table agentstack.scheduled_tasks
  drop constraint if exists scheduled_tasks_execution_target_check;
alter table agentstack.scheduled_tasks
  add constraint scheduled_tasks_execution_target_check
  check (execution_target in ('cloud','auto','macos','android'));

create index if not exists scheduled_tasks_device_due_idx
  on agentstack.scheduled_tasks(device_id, status, run_at)
  where device_id is not null and status = 'pending';


create table if not exists agentstack.observer_settings (
  device_id uuid primary key references agentstack.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  excluded_apps text[] not null default '{}',
  anonymous_improvement boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table agentstack.observer_settings enable row level security;
create policy "owners read observer settings"
  on agentstack.observer_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.observer_settings from anon, authenticated;
grant select on agentstack.observer_settings to authenticated;
grant all on agentstack.observer_settings to service_role;


create table if not exists agentstack.device_observations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  observed_at timestamptz not null,
  app_id text not null,
  window_class text,
  event_type text not null,
  domain text,
  element_role text,
  -- Deliberately metadata-only. No typed body, email/DM text, screenshot or
  -- clipboard payload belongs in this table.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_observations_device_time_idx
  on agentstack.device_observations(device_id, observed_at desc);

alter table agentstack.device_observations enable row level security;
create policy "owners read sanitized observations"
  on agentstack.device_observations for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.device_observations from anon, authenticated;
grant select on agentstack.device_observations to authenticated;
grant all on agentstack.device_observations to service_role;


create table if not exists agentstack.detected_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  fingerprint text not null,
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  occurrences integer not null default 1,
  confidence numeric(4,3) not null default 0,
  status text not null default 'detected'
    check (status in ('detected','accepted','ignored','archived')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, device_id, fingerprint)
);

alter table agentstack.detected_workflows enable row level security;
create policy "owners read detected workflows"
  on agentstack.detected_workflows for select
  to authenticated
  using ((select auth.uid()) = user_id);
revoke insert, update, delete on agentstack.detected_workflows from anon, authenticated;
grant select on agentstack.detected_workflows to authenticated;
grant all on agentstack.detected_workflows to service_role;

notify pgrst, 'reload schema';

-- ========================================================================
-- 0034_workflow_shadow_mode.sql
-- ========================================================================

-- Workflow review and shadow-mode state.
alter table agentstack.detected_workflows
  add column if not exists mode text not null default 'observe',
  add column if not exists shadow_runs integer not null default 0,
  add column if not exists last_shadow_result jsonb;

alter table agentstack.detected_workflows
  drop constraint if exists detected_workflows_mode_check;
alter table agentstack.detected_workflows
  add constraint detected_workflows_mode_check
  check (mode in ('observe','shadow','assist','run_with_approvals','autopilot'));

notify pgrst, 'reload schema';

-- ========================================================================
-- 20261008172940_kryx_v2_jobs.sql
-- ========================================================================

-- Promote existing hybrid missions to Jobs. Legacy rows have task_class=NULL.
-- No user, balance, history, agent, device, or billing row is deleted/reset.
begin;
alter table agentstack.hybrid_missions drop constraint if exists hybrid_missions_status_check;
alter table agentstack.hybrid_missions add constraint hybrid_missions_status_check check (status in (
  'created','planning','ready','queued','running','waiting_for_browser','waiting_for_device','waiting_for_user',
  'blocked','recovering','verifying','completed','failed','refunded','cancelled'
));
alter table agentstack.hybrid_missions
  add column if not exists task_class text check(task_class in ('LEAD_LIST','RESEARCH_BRIEF','COMPETITOR_SCAN','OUTREACH_DRAFTS','CONTENT_REPURPOSE')),
  add column if not exists completion_contract jsonb,
  add column if not exists estimate_min integer,
  add column if not exists hard_cap integer check(hard_cap between 1 and 2000),
  add column if not exists reserved_credits integer not null default 0 check(reserved_credits >= 0),
  add column if not exists is_free boolean not null default false,
  add column if not exists receipt jsonb,
  add column if not exists output_hash text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt integer not null default 0,
  add column if not exists max_attempts integer not null default 3 check(max_attempts between 1 and 5),
  add column if not exists retry_at timestamptz,
  add column if not exists next_run_at timestamptz,
  add column if not exists request_key uuid;
create unique index if not exists hybrid_missions_owner_key on agentstack.hybrid_missions(id,user_id);
create unique index if not exists jobs_request_key on agentstack.hybrid_missions(user_id,request_key) where request_key is not null;
create index if not exists jobs_queue on agentstack.hybrid_missions(status,retry_at,created_at) where task_class is not null;
alter table agentstack.hybrid_mission_steps add column if not exists attempt integer not null default 0;

create table if not exists agentstack.job_messages (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 20000),
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_events (
  id bigint generated always as identity primary key, job_id uuid not null, user_id uuid not null,
  event_type text not null, label text not null, detail jsonb not null default '{}',
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_artifacts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  name text not null check(name ~ '^[a-zA-Z0-9_.-]{1,120}$'), media_type text not null,
  content text not null check(length(content) <= 2000000), sha256 text not null,
  created_at timestamptz not null default now(), unique(job_id,name),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_verifications (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  worker_run_id uuid not null, verifier_run_id uuid not null check(worker_run_id <> verifier_run_id),
  contract_version text not null, output_hash text not null, passed boolean not null,
  result jsonb not null, verifier text not null, created_at timestamptz not null default now(),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_checkpoints (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  step text not null, state jsonb not null, lease_token uuid not null,
  created_at timestamptz not null default now(), unique(job_id,step),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_usage (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  operation_key text not null, run_id uuid not null, service text not null, model text,
  credits integer not null check(credits >= 0), input_tokens integer, output_tokens integer,
  provider_cost_usd numeric check(provider_cost_usd >= 0), outcome text not null check(outcome in ('started','succeeded','failed')),
  latency_ms integer, error_code text, created_at timestamptz not null default now(), unique(job_id,operation_key),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.job_ledger (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  kind text not null check(kind in ('reserve','settle','release','refund','free_completion')),
  credits integer not null check(credits >= 0), reason text not null,
  created_at timestamptz not null default now(), unique(job_id,kind),
  foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);
create table if not exists agentstack.reliability_ledger (
  id uuid primary key default gen_random_uuid(), job_id uuid not null, user_id uuid not null,
  task_class text not null, domain text, tool text not null, action text not null, method text not null,
  expected_state text, observed_state text, success boolean not null, failure_category text,
  latency_ms integer not null, attempt integer not null, verification_passed boolean, cost_credits integer not null default 0,
  created_at timestamptz not null default now(), foreign key(job_id,user_id) references agentstack.hybrid_missions(id,user_id) on delete cascade
);

do $$ declare t text; begin
  foreach t in array array['job_messages','job_events','job_artifacts','job_verifications','job_checkpoints','job_usage','job_ledger','reliability_ledger'] loop
    execute format('alter table agentstack.%I enable row level security',t);
    execute format('revoke all on agentstack.%I from public,anon,authenticated',t);
    execute format('grant select on agentstack.%I to authenticated',t);
    execute format('grant all on agentstack.%I to service_role',t);
    execute format('drop policy if exists owner_read on agentstack.%I',t);
    execute format('create policy owner_read on agentstack.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('create index if not exists %I on agentstack.%I(job_id,created_at)',t || '_job_time',t);
  end loop;
end $$;
grant usage,select on sequence agentstack.job_events_id_seq to service_role;

-- Only the server verifier may authorize verified completion; legacy missions remain readable.
create or replace function agentstack.guard_verified_job_completion() returns trigger language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  if new.task_class is not null and new.status='completed' and old.status is distinct from 'completed' then
    if not exists(select 1 from agentstack.job_verifications v where v.job_id=new.id and v.user_id=new.user_id and v.passed
      and v.output_hash=new.output_hash and v.contract_version=new.completion_contract->>'version') then
      raise exception 'verified completion requires a passing independent verification for this output and contract';
    end if;
    if not exists(select 1 from agentstack.job_artifacts a where a.job_id=new.id and a.user_id=new.user_id) then
      raise exception 'verified completion requires an artifact';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_verified_job_completion on agentstack.hybrid_missions;
create trigger guard_verified_job_completion before update on agentstack.hybrid_missions for each row execute function agentstack.guard_verified_job_completion();
revoke all on function agentstack.guard_verified_job_completion() from public,anon,authenticated;

create or replace function agentstack.create_verified_job(p_user_id uuid,p_goal text,p_contract jsonb,p_min integer,p_max integer,p_cap integer,p_key uuid)
returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; step_id uuid; previous_id uuid; ordinal_index integer;
begin
  if p_cap < p_max or p_min < 0 or p_max < 1 or p_key is null or p_contract->>'version' is null then raise exception 'invalid job contract/budget'; end if;
  insert into agentstack.hybrid_missions(user_id,instruction,task_class,completion_contract,estimate_min,estimated_credits,hard_cap,request_key,status,requested_execution,planner)
  values(p_user_id,p_goal,p_contract->>'taskClass',p_contract,p_min,p_max,p_cap,p_key,'created','cloud','{"engine":"verified_jobs_v2"}'::jsonb)
  on conflict(user_id,request_key) where request_key is not null do nothing returning * into j;
  if j.id is null then select * into j from agentstack.hybrid_missions where user_id=p_user_id and request_key=p_key; return to_jsonb(j); end if;
  for ordinal_index in 0..3 loop
    insert into agentstack.hybrid_mission_steps(mission_id,user_id,ordinal,label,execution,depends_on,input)
    values(j.id,p_user_id,ordinal_index,(array['Researching sources','Checking founder identities','Independently verifying the result','Preparing artifacts and settling credits'])[ordinal_index+1],
      'cloud',case when previous_id is null then '{}'::uuid[] else array[previous_id] end,jsonb_build_object('contract_version',p_contract->>'version')) returning id into step_id;
    previous_id:=step_id;
  end loop;
  insert into agentstack.job_messages(job_id,user_id,role,content) values(j.id,p_user_id,'user',p_goal);
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user_id,'job_created','Completion criteria are ready for review');
  return to_jsonb(j);
end $$;
revoke all on function agentstack.create_verified_job(uuid,text,jsonb,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function agentstack.create_verified_job(uuid,text,jsonb,integer,integer,integer,uuid) to service_role;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261008173458_kryx_v2_execution.sql
-- ========================================================================

begin;
-- Queue operations run as service_role (SECURITY INVOKER), not as public RPCs.
create or replace function agentstack.claim_verified_job() returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions where task_class is not null
    and status in ('queued','recovering','running','verifying')
    and (retry_at is null or retry_at <= now()) and (lease_expires_at is null or lease_expires_at < now())
    order by created_at for update skip locked limit 1;
  if j.id is null then return null; end if;
  update agentstack.hybrid_missions set lease_token=gen_random_uuid(),lease_expires_at=now()+interval '6 minutes',
    status='running',started_at=coalesce(started_at,now()),updated_at=now() where id=j.id returning * into j;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'job_started','Continuing from the latest safe checkpoint');
  return to_jsonb(j);
end $$;

create or replace function agentstack.checkpoint_verified_job(p_job uuid,p_token uuid,p_step text,p_state jsonb,p_label text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  insert into agentstack.job_checkpoints(job_id,user_id,step,state,lease_token) values(j.id,j.user_id,p_step,p_state,p_token)
    on conflict(job_id,step) do update set state=excluded.state,lease_token=excluded.lease_token,created_at=now();
  update agentstack.hybrid_mission_steps set status=case when p_state->>'stage'='finish' and p_state->'verification'->>'passed'='false' then 'failed' else 'completed' end,
    output=jsonb_build_object('checkpoint_step',p_step,'next_stage',p_state->>'stage'),finished_at=now()
    where mission_id=j.id and ordinal=case p_state->>'stage' when 'extract' then 0 when 'verify' then 1 when 'finish' then 2 else -1 end;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'checkpoint_created',p_label);
  update agentstack.hybrid_missions set status='queued',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  return true;
end $$;

create or replace function agentstack.recover_verified_job(p_job uuid,p_token uuid,p_category text,p_message text,p_decision text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if p_decision not in ('retry','needs_user','fail') then raise exception 'invalid recovery decision'; end if;
  if p_decision='retry' and j.attempt>=j.max_attempts then p_decision:='fail'; end if;
  if p_decision='retry' and p_category='verification_failed' then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=1;
    update agentstack.job_checkpoints set state=(state - 'verification' - 'verifierRunId') || jsonb_build_object('stage','extract','output',null,'billableKeys',coalesce(state->'discoveryKeys','[]'::jsonb)) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='fail' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=j.user_id;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'refund',j.reserved_credits,'No verified completion; reservation returned') on conflict do nothing;
  end if;
  if p_decision='fail' then update agentstack.hybrid_mission_steps set status='failed' where mission_id=j.id and status<>'completed'; end if;
  update agentstack.hybrid_missions set status=case p_decision when 'retry' then 'recovering' when 'needs_user' then 'waiting_for_user' else 'refunded' end,
    summary=left(p_message,2000),attempt=attempt+case when p_decision='retry' then 1 else 0 end,
    retry_at=case when p_decision='retry' then now()+make_interval(secs=>least(120,15*j.attempt)) else null end,
    reserved_credits=case when p_decision='fail' then 0 else reserved_credits end,
    finished_at=case when p_decision='fail' then now() else null end,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail) values(j.id,j.user_id,
    case p_decision when 'retry' then 'recovery_started' when 'needs_user' then 'approval_requested' else 'job_refunded' end,left(p_message,500),jsonb_build_object('category',p_category));
  return true;
end $$;
do $$ declare signature text; begin
  foreach signature in array array['claim_verified_job()','checkpoint_verified_job(uuid,uuid,text,jsonb,text)','recover_verified_job(uuid,uuid,text,text,text)'] loop
    execute 'revoke all on function agentstack.' || signature || ' from public,anon,authenticated';
    execute 'grant execute on function agentstack.' || signature || ' to service_role';
  end loop;
end $$;
insert into agentstack.cron_ticks(worker,last_run_at) values('jobs',null) on conflict(worker) do nothing;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261008173751_kryx_v2_accounting.sql
-- ========================================================================

begin;
create or replace function agentstack.start_verified_job(p_job uuid,p_user uuid,p_cap integer) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; wallet integer; free_job boolean;
begin
  select credit_balance into wallet from agentstack.profiles where id=p_user for update;
  if wallet is null then raise exception 'account unavailable'; end if;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then raise exception 'job not found'; end if;
  if j.status in ('queued','running','recovering','verifying') then return to_jsonb(j); end if;
  if j.status not in ('created','ready') then raise exception 'job cannot be started from this state'; end if;
  if p_cap < j.estimated_credits or p_cap>2000 then raise exception 'invalid hard cap'; end if;
  if (select count(*) from agentstack.hybrid_missions where user_id=p_user and task_class is not null and status in ('queued','running','recovering','verifying','waiting_for_user','waiting_for_browser')) >= 3 then raise exception 'concurrent job limit reached'; end if;
  free_job := not exists(select 1 from agentstack.hybrid_missions where user_id=p_user and is_free and status not in ('created','ready','failed','refunded','cancelled'));
  if not free_job and wallet<p_cap then raise exception 'not enough credits for the hard cap'; end if;
  if not free_job then update agentstack.profiles set credit_balance=credit_balance-p_cap where id=p_user; end if;
  update agentstack.hybrid_missions set status='queued',hard_cap=p_cap,reserved_credits=case when free_job then 0 else p_cap end,is_free=free_job,attempt=1,summary=null,updated_at=now() where id=j.id returning * into j;
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,p_user,'reserve',j.reserved_credits,case when free_job then 'First verified completion reserved for free' else 'Held until verified settlement; not a completion charge' end);
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_planned','Queued for background execution');
  return to_jsonb(j);
end $$;

create or replace function agentstack.control_verified_job(p_job uuid,p_user uuid,p_action text) returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=p_user for update;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then return false; end if;
  if j.status in ('completed','failed','refunded','cancelled') then return p_action='cancel' and j.status='cancelled'; end if;
  if p_action='cancel' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=p_user;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,p_user,'release',j.reserved_credits,'Founder cancelled; no completion charged') on conflict do nothing;
    update agentstack.hybrid_missions set status='cancelled',reserved_credits=0,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=j.id;
  elsif p_action='pause' and j.status in ('queued','running','recovering','verifying') then
    update agentstack.hybrid_missions set status='waiting_for_user',summary='Paused by you',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  elsif p_action='resume' and j.status='waiting_for_user' then
    update agentstack.hybrid_missions set status='queued',summary=null,retry_at=null,updated_at=now() where id=j.id;
  else return false;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_' || p_action,'Job ' || p_action || ' requested by you');
  return true;
end $$;

create or replace function agentstack.begin_job_operation(p_job uuid,p_token uuid,p_key text,p_run uuid,p_service text,p_model text,p_credits integer)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; spent integer; operation_id uuid;
begin
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  if p_credits<0 then raise exception 'invalid work units'; end if;
  select id into operation_id from agentstack.job_usage where job_id=p_job and operation_key=p_key;
  if operation_id is not null then raise exception 'operation already reserved'; end if;
  select coalesce(sum(credits),0) into spent from agentstack.job_usage where job_id=p_job;
  if spent+p_credits>j.hard_cap then raise exception 'credit_cap'; end if;
  insert into agentstack.job_usage(job_id,user_id,operation_key,run_id,service,model,credits,outcome) values(p_job,j.user_id,p_key,p_run,p_service,p_model,p_credits,'started') returning id into operation_id;
  return operation_id;
end $$;
create or replace function agentstack.finish_job_operation(p_job uuid,p_token uuid,p_operation uuid,p_ok boolean,p_latency integer,p_input integer,p_output integer,p_cost numeric,p_error text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  perform 1 from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if not found then return false; end if;
  update agentstack.job_usage set outcome=case when p_ok then 'succeeded' else 'failed' end,latency_ms=p_latency,input_tokens=p_input,output_tokens=p_output,provider_cost_usd=p_cost,error_code=p_error where id=p_operation and job_id=p_job and outcome='started';
  return found;
end $$;

create or replace function agentstack.complete_verified_job(p_job uuid,p_token uuid,p_hash text,p_keys text[],p_receipt jsonb) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; charge integer; released integer; v agentstack.job_verifications; r jsonb;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and task_class is not null and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  select * into v from agentstack.job_verifications where job_id=j.id and passed and output_hash=p_hash and contract_version=j.completion_contract->>'version' order by created_at desc limit 1;
  if v.id is null or v.worker_run_id=v.verifier_run_id then raise exception 'verification required'; end if;
  if exists(select 1 from unnest(p_keys) k where not exists(select 1 from agentstack.job_usage u where u.job_id=j.id and u.operation_key=k and u.outcome='succeeded')) then raise exception 'billable operation missing or unsuccessful'; end if;
  select coalesce(sum(credits),0) into charge from agentstack.job_usage where job_id=j.id and operation_key=any(p_keys) and outcome='succeeded';
  if j.is_free then charge:=0; end if;
  if charge>j.hard_cap or charge>j.reserved_credits and not j.is_free then raise exception 'credit cap exceeded'; end if;
  released:=j.reserved_credits-charge;
  update agentstack.profiles set credit_balance=credit_balance+released,credits_spent=credits_spent+charge where id=j.user_id;
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,case when j.is_free then 'free_completion' else 'settle' end,charge,'Independent verification passed');
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'release',released,'Unused reservation returned; internal failed attempts not billed');
  r:=p_receipt || jsonb_build_object('creditsUsed',charge,'releasedCredits',released,'failedAttemptsCharged',0,'elapsedSeconds',greatest(0,extract(epoch from now()-j.started_at)::integer));
  update agentstack.hybrid_missions set status='completed',output_hash=p_hash,receipt=r,credits_used=charge,reserved_credits=0,summary=r->>'result',finished_at=now(),updated_at=now(),lease_token=null,lease_expires_at=null where id=j.id;
  update agentstack.hybrid_mission_steps set status='completed',finished_at=coalesce(finished_at,now()) where mission_id=j.id;
  insert into agentstack.job_messages(job_id,user_id,role,content) values(j.id,j.user_id,'assistant',r->>'result');
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'verification_passed','Independent completion checks passed'),(j.id,j.user_id,'job_completed',r->>'result');
  return r;
end $$;
do $$ declare signature text; begin
 foreach signature in array array['start_verified_job(uuid,uuid,integer)','control_verified_job(uuid,uuid,text)','begin_job_operation(uuid,uuid,text,uuid,text,text,integer)','finish_job_operation(uuid,uuid,uuid,boolean,integer,integer,integer,numeric,text)','complete_verified_job(uuid,uuid,text,text[],jsonb)'] loop
  execute 'revoke all on function agentstack.' || signature || ' from public,anon,authenticated';
  execute 'grant execute on function agentstack.' || signature || ' to service_role';
 end loop;
end $$;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261008175055_kryx_v2_result_fencing.sql
-- ========================================================================

begin;
-- Result, verdict, and artifacts are persisted atomically under a current worker lease.
-- A paused/replaced worker cannot overwrite the deliverable after losing ownership.
create or replace function agentstack.store_verified_job_result(p_job uuid,p_token uuid,p_worker uuid,p_verdict jsonb,p_artifacts jsonb)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; verification_id uuid; artifact jsonb; passed boolean;
begin
 select * into j from agentstack.hybrid_missions where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
 if j.id is null then raise exception 'worker lease lost'; end if;
 if p_worker=(p_verdict->>'verifierRunId')::uuid or p_worker is null or p_verdict->>'verifierRunId' is null then raise exception 'independent verifier required'; end if;
 if p_verdict->>'contractVersion' is distinct from j.completion_contract->>'version' or p_verdict->>'outputHash' !~ '^[0-9a-f]{64}$' then raise exception 'invalid verification binding'; end if;
 if jsonb_typeof(p_verdict->'passed') is distinct from 'boolean' or jsonb_typeof(p_verdict->'checks') is distinct from 'array' then raise exception 'invalid verifier result'; end if;
 passed:=(p_verdict->>'passed')::boolean;
 if passed and (jsonb_array_length(p_verdict->'checks')=0 or exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'passed' is distinct from 'true')
   or exists(select 1 from jsonb_array_elements(j.completion_contract->'predicates') p where not exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'id'=p->>'id' and c->>'passed'='true'))) then raise exception 'all completion checks required'; end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' or passed and jsonb_array_length(p_artifacts)=0 then raise exception 'verified artifact required'; end if;
 for artifact in select * from jsonb_array_elements(p_artifacts) loop
  if length(coalesce(artifact->>'content',''))=0 or artifact->>'sha256' is distinct from encode(sha256(convert_to(artifact->>'content','UTF8')),'hex') then raise exception 'artifact digest mismatch'; end if;
  insert into agentstack.job_artifacts(job_id,user_id,name,media_type,content,sha256)
  values(j.id,j.user_id,artifact->>'name',artifact->>'media_type',artifact->>'content',artifact->>'sha256')
  on conflict(job_id,name) do update set content=excluded.content,sha256=excluded.sha256,media_type=excluded.media_type,created_at=now();
 end loop;
 insert into agentstack.job_verifications(job_id,user_id,worker_run_id,verifier_run_id,contract_version,output_hash,passed,result,verifier)
 values(j.id,j.user_id,p_worker,(p_verdict->>'verifierRunId')::uuid,p_verdict->>'contractVersion',p_verdict->>'outputHash',passed,p_verdict,'independent_source_reads_and_separate_model_pass') returning id into verification_id;
 update agentstack.hybrid_missions set output_hash=p_verdict->>'outputHash' where id=j.id;
 return verification_id;
end $$;
revoke all on function agentstack.store_verified_job_result(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function agentstack.store_verified_job_result(uuid,uuid,uuid,jsonb,jsonb) to service_role;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261010085050_kryx_v2_resumable_progress.sql
-- ========================================================================

begin;
-- Save in-flight progress without releasing the current fenced lease.
create or replace function agentstack.save_verified_job_progress(p_job uuid,p_token uuid,p_state jsonb,p_label text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions
    where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now()
      and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if jsonb_typeof(p_state) is distinct from 'object' or p_state->>'stage' not in ('discover','extract','verify','finish')
    or p_state->>'workerRunId' is null or jsonb_typeof(p_state->'billableKeys') is distinct from 'array'
    or octet_length(p_state::text)>2000000 then raise exception 'invalid pipeline progress'; end if;
  insert into agentstack.job_checkpoints(job_id,user_id,step,state,lease_token)
    values(j.id,j.user_id,'pipeline',p_state,p_token)
    on conflict(job_id,step) do update set state=excluded.state,lease_token=excluded.lease_token,created_at=now();
  insert into agentstack.job_events(job_id,user_id,event_type,label)
    values(j.id,j.user_id,'checkpoint_created',left(p_label,500));
  return true;
end $$;
revoke all on function agentstack.save_verified_job_progress(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function agentstack.save_verified_job_progress(uuid,uuid,jsonb,text) to service_role;
create or replace function agentstack.recover_verified_job(p_job uuid,p_token uuid,p_category text,p_message text,p_decision text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if p_decision not in ('retry','needs_user','fail') then raise exception 'invalid recovery decision'; end if;
  if p_decision='retry' and j.attempt>=j.max_attempts then p_decision:='fail'; end if;
  if p_decision='retry' and p_category='verification_failed' then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=1;
    update agentstack.job_checkpoints set state=(state - 'verification' - 'verifierRunId' - 'verificationSources' - 'verificationCursor') || jsonb_build_object('stage','extract','output',null,'billableKeys',coalesce(state->'discoveryKeys','[]'::jsonb)) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='retry' and p_category='source_unavailable' then
    update agentstack.job_checkpoints set state=(state - 'discoveryUrls' - 'discoveryCursor') || jsonb_build_object('stage','discover','sources','[]'::jsonb,'billableKeys','[]'::jsonb) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='fail' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=j.user_id;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'refund',j.reserved_credits,'No verified completion; reservation returned') on conflict do nothing;
  end if;
  if p_decision='fail' then update agentstack.hybrid_mission_steps set status='failed' where mission_id=j.id and status<>'completed'; end if;
  update agentstack.hybrid_missions set status=case p_decision when 'retry' then 'recovering' when 'needs_user' then 'waiting_for_user' else 'refunded' end,
    summary=left(p_message,2000),attempt=attempt+case when p_decision='retry' then 1 else 0 end,
    retry_at=case when p_decision='retry' then now()+make_interval(secs=>least(120,15*j.attempt)) else null end,
    reserved_credits=case when p_decision='fail' then 0 else reserved_credits end,
    finished_at=case when p_decision='fail' then now() else null end,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail) values(j.id,j.user_id,
    case p_decision when 'retry' then 'recovery_started' when 'needs_user' then 'approval_requested' else 'job_refunded' end,left(p_message,500),jsonb_build_object('category',p_category));
  return true;
end $$;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261010085739_kryx_v2_cap_resume.sql
-- ========================================================================

begin;
alter table agentstack.hybrid_missions add column if not exists blocker_category text;
alter table agentstack.job_ledger add column if not exists detail jsonb not null default '{}';
alter table agentstack.job_ledger drop constraint if exists job_ledger_kind_check;
alter table agentstack.job_ledger add constraint job_ledger_kind_check
  check(kind in ('reserve','reserve_increase','settle','release','refund','free_completion'));
-- Initial/terminal entries remain unique; each explicit cap increase gets its own immutable entry.
alter table agentstack.job_ledger drop constraint if exists job_ledger_job_id_kind_key;
create unique index if not exists job_ledger_single_kind on agentstack.job_ledger(job_id,kind)
  where kind<>'reserve_increase';

update agentstack.hybrid_missions j set blocker_category=coalesce(
  (select e.detail->>'category' from agentstack.job_events e where e.job_id=j.id and e.event_type='approval_requested' order by e.created_at desc,e.id desc limit 1),
  case when j.summary='Paused by you' then 'paused_by_user' end)
  where j.task_class is not null and j.status='waiting_for_user' and j.blocker_category is null;

create or replace function agentstack.resume_verified_job(p_job uuid,p_user uuid,p_cap integer)
returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; wallet integer; target_cap integer; increase integer; held integer;
begin
  select credit_balance into wallet from agentstack.profiles where id=p_user for update;
  if wallet is null then raise exception 'account unavailable'; end if;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then raise exception 'job not found'; end if;
  target_cap:=coalesce(p_cap,j.hard_cap);
  if j.status in ('queued','running','recovering','verifying') and target_cap=j.hard_cap then return to_jsonb(j); end if;
  if j.status<>'waiting_for_user' then raise exception 'job must be paused before adjusting its cap'; end if;
  if target_cap<j.hard_cap or target_cap<j.estimated_credits or target_cap>2000 then raise exception 'invalid hard cap'; end if;
  if j.blocker_category='credit_cap' and target_cap<=j.hard_cap then raise exception 'higher cap required'; end if;
  increase:=target_cap-j.hard_cap;
  held:=case when j.is_free then 0 else increase end;
  if wallet<held then raise exception 'not enough credits for the increased cap'; end if;
  if increase>0 then
    update agentstack.profiles set credit_balance=credit_balance-held where id=p_user;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason,detail)
      values(j.id,p_user,'reserve_increase',held,'Founder explicitly increased the hard cap',
        jsonb_build_object('previousCap',j.hard_cap,'newCap',target_cap,'internalBudgetIncrease',increase));
  end if;
  update agentstack.hybrid_missions set status='queued',hard_cap=target_cap,reserved_credits=reserved_credits+held,
    blocker_category=null,summary=null,retry_at=null,lease_token=null,lease_expires_at=null,updated_at=now()
    where id=j.id returning * into j;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail)
    values(j.id,p_user,'job_resume','Resumed by you',jsonb_build_object('hardCap',target_cap,'additionalReservation',held));
  return to_jsonb(j);
end $$;
revoke all on function agentstack.resume_verified_job(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function agentstack.resume_verified_job(uuid,uuid,integer) to service_role;
create or replace function agentstack.control_verified_job(p_job uuid,p_user uuid,p_action text) returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=p_user for update;
  select * into j from agentstack.hybrid_missions where id=p_job and user_id=p_user and task_class is not null for update;
  if j.id is null then return false; end if;
  if j.status in ('completed','failed','refunded','cancelled') then return p_action='cancel' and j.status='cancelled'; end if;
  if p_action='cancel' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=p_user;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,p_user,'release',j.reserved_credits,'Founder cancelled; no completion charged') on conflict do nothing;
    update agentstack.hybrid_missions set status='cancelled',blocker_category=null,reserved_credits=0,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now() where id=j.id;
  elsif p_action='pause' and j.status in ('queued','running','recovering','verifying') then
    update agentstack.hybrid_missions set status='waiting_for_user',blocker_category='paused_by_user',summary='Paused by you',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  elsif p_action='resume' and j.status='waiting_for_user' then
    update agentstack.hybrid_missions set status='queued',blocker_category=null,summary=null,retry_at=null,updated_at=now() where id=j.id;
  else return false;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,p_user,'job_' || p_action,'Job ' || p_action || ' requested by you');
  return true;
end $$;
create or replace function agentstack.recover_verified_job(p_job uuid,p_token uuid,p_category text,p_message text,p_decision text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  if p_decision not in ('retry','needs_user','fail') then raise exception 'invalid recovery decision'; end if;
  if p_decision='retry' and j.attempt>=j.max_attempts then p_decision:='fail'; end if;
  if p_decision='retry' and p_category='verification_failed' then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=1;
    update agentstack.job_checkpoints set state=(state - 'verification' - 'verifierRunId' - 'verificationSources' - 'verificationCursor') || jsonb_build_object('stage','extract','output',null,'billableKeys',coalesce(state->'discoveryKeys','[]'::jsonb)) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='retry' and p_category='source_unavailable' then
    update agentstack.job_checkpoints set state=(state - 'discoveryUrls' - 'discoveryCursor') || jsonb_build_object('stage','discover','sources','[]'::jsonb,'billableKeys','[]'::jsonb) where job_id=j.id and step='pipeline';
  end if;
  if p_decision='fail' then
    update agentstack.profiles set credit_balance=credit_balance+j.reserved_credits where id=j.user_id;
    insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'refund',j.reserved_credits,'No verified completion; reservation returned') on conflict do nothing;
  end if;
  if p_decision='fail' then update agentstack.hybrid_mission_steps set status='failed' where mission_id=j.id and status<>'completed'; end if;
  update agentstack.hybrid_missions set status=case p_decision when 'retry' then 'recovering' when 'needs_user' then 'waiting_for_user' else 'refunded' end,
    blocker_category=case when p_decision='needs_user' then p_category else null end,
    summary=left(p_message,2000),attempt=attempt+case when p_decision='retry' then 1 else 0 end,
    retry_at=case when p_decision='retry' then now()+make_interval(secs=>least(120,15*j.attempt)) else null end,
    reserved_credits=case when p_decision='fail' then 0 else reserved_credits end,
    finished_at=case when p_decision='fail' then now() else null end,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  insert into agentstack.job_events(job_id,user_id,event_type,label,detail) values(j.id,j.user_id,
    case p_decision when 'retry' then 'recovery_started' when 'needs_user' then 'approval_requested' else 'job_refunded' end,left(p_message,500),jsonb_build_object('category',p_category));
  return true;
end $$;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261010092918_kryx_v2_proof_expiry.sql
-- ========================================================================

begin;
create or replace function agentstack.verified_result_is_fresh(p_result jsonb,p_contract jsonb)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare verified timestamptz; maximum_age integer;
begin
  if coalesce(p_result->>'verifiedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then return false; end if;
  verified:=(p_result->>'verifiedAt')::timestamptz;
  select (p->>'value')::integer into maximum_age from jsonb_array_elements(p_contract->'predicates') p
    where p->>'kind'='URL_RESOLVES' limit 1;
  maximum_age:=coalesce(maximum_age,1800);
  return maximum_age between 1 and 86400 and verified<=now()+interval '30 seconds'
    and verified>=now()-make_interval(secs=>maximum_age);
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return false;
end $$;
revoke all on function agentstack.verified_result_is_fresh(jsonb,jsonb) from public,anon,authenticated;
grant execute on function agentstack.verified_result_is_fresh(jsonb,jsonb) to service_role;
create or replace function agentstack.store_verified_job_result(p_job uuid,p_token uuid,p_worker uuid,p_verdict jsonb,p_artifacts jsonb)
returns uuid language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; verification_id uuid; artifact jsonb; passed boolean;
begin
 select * into j from agentstack.hybrid_missions where id=p_job and task_class is not null and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
 if j.id is null then raise exception 'worker lease lost'; end if;
 if p_worker=(p_verdict->>'verifierRunId')::uuid or p_worker is null or p_verdict->>'verifierRunId' is null then raise exception 'independent verifier required'; end if;
 if p_verdict->>'contractVersion' is distinct from j.completion_contract->>'version' or p_verdict->>'outputHash' !~ '^[0-9a-f]{64}$' then raise exception 'invalid verification binding'; end if;
 if jsonb_typeof(p_verdict->'passed') is distinct from 'boolean' or jsonb_typeof(p_verdict->'checks') is distinct from 'array' then raise exception 'invalid verifier result'; end if;
 passed:=(p_verdict->>'passed')::boolean;
 if passed and not agentstack.verified_result_is_fresh(p_verdict,j.completion_contract) then raise exception 'verification proof expired or timestamp invalid'; end if;
 if passed and (jsonb_array_length(p_verdict->'checks')=0 or exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'passed' is distinct from 'true')
   or exists(select 1 from jsonb_array_elements(j.completion_contract->'predicates') p where not exists(select 1 from jsonb_array_elements(p_verdict->'checks') c where c->>'id'=p->>'id' and c->>'passed'='true'))) then raise exception 'all completion checks required'; end if;
 if jsonb_typeof(p_artifacts) is distinct from 'array' or passed and jsonb_array_length(p_artifacts)=0 then raise exception 'verified artifact required'; end if;
 for artifact in select * from jsonb_array_elements(p_artifacts) loop
  if length(coalesce(artifact->>'content',''))=0 or artifact->>'sha256' is distinct from encode(sha256(convert_to(artifact->>'content','UTF8')),'hex') then raise exception 'artifact digest mismatch'; end if;
  insert into agentstack.job_artifacts(job_id,user_id,name,media_type,content,sha256)
  values(j.id,j.user_id,artifact->>'name',artifact->>'media_type',artifact->>'content',artifact->>'sha256')
  on conflict(job_id,name) do update set content=excluded.content,sha256=excluded.sha256,media_type=excluded.media_type,created_at=now();
 end loop;
 insert into agentstack.job_verifications(job_id,user_id,worker_run_id,verifier_run_id,contract_version,output_hash,passed,result,verifier)
 values(j.id,j.user_id,p_worker,(p_verdict->>'verifierRunId')::uuid,p_verdict->>'contractVersion',p_verdict->>'outputHash',passed,p_verdict,'independent_source_reads_and_separate_model_pass') returning id into verification_id;
 update agentstack.hybrid_missions set output_hash=p_verdict->>'outputHash' where id=j.id;
 return verification_id;
end $$;
create or replace function agentstack.complete_verified_job(p_job uuid,p_token uuid,p_hash text,p_keys text[],p_receipt jsonb) returns jsonb language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions; charge integer; released integer; v agentstack.job_verifications; r jsonb;
begin
  perform 1 from agentstack.profiles where id=(select user_id from agentstack.hybrid_missions where id=p_job) for update;
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and task_class is not null and status in ('running','verifying') for update;
  if j.id is null then raise exception 'worker lease lost'; end if;
  select * into v from agentstack.job_verifications where job_id=j.id and passed and agentstack.verified_result_is_fresh(result,j.completion_contract) and output_hash=p_hash and contract_version=j.completion_contract->>'version' order by created_at desc limit 1;
  if v.id is null or v.worker_run_id=v.verifier_run_id then raise exception 'verification required'; end if;
  if exists(select 1 from unnest(p_keys) k where not exists(select 1 from agentstack.job_usage u where u.job_id=j.id and u.operation_key=k and u.outcome='succeeded')) then raise exception 'billable operation missing or unsuccessful'; end if;
  select coalesce(sum(credits),0) into charge from agentstack.job_usage where job_id=j.id and operation_key=any(p_keys) and outcome='succeeded';
  if j.is_free then charge:=0; end if;
  if charge>j.hard_cap or charge>j.reserved_credits and not j.is_free then raise exception 'credit cap exceeded'; end if;
  released:=j.reserved_credits-charge;
  update agentstack.profiles set credit_balance=credit_balance+released,credits_spent=credits_spent+charge where id=j.user_id;
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,case when j.is_free then 'free_completion' else 'settle' end,charge,'Independent verification passed');
  insert into agentstack.job_ledger(job_id,user_id,kind,credits,reason) values(j.id,j.user_id,'release',released,'Unused reservation returned; internal failed attempts not billed');
  r:=p_receipt || jsonb_build_object('creditsUsed',charge,'releasedCredits',released,'failedAttemptsCharged',0,'elapsedSeconds',greatest(0,extract(epoch from now()-j.started_at)::integer));
  update agentstack.hybrid_missions set status='completed',output_hash=p_hash,receipt=r,credits_used=charge,reserved_credits=0,summary=r->>'result',finished_at=now(),updated_at=now(),lease_token=null,lease_expires_at=null where id=j.id;
  update agentstack.hybrid_mission_steps set status='completed',finished_at=coalesce(finished_at,now()) where mission_id=j.id;
  insert into agentstack.job_messages(job_id,user_id,role,content) values(j.id,j.user_id,'assistant',r->>'result');
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'verification_passed','Independent completion checks passed'),(j.id,j.user_id,'job_completed',r->>'result');
  return r;
end $$;
create or replace function agentstack.guard_verified_job_completion() returns trigger language plpgsql security invoker set search_path=agentstack,pg_temp as $$
begin
  if new.task_class is not null and new.status='completed' and old.status is distinct from 'completed' then
    if not exists(select 1 from agentstack.job_verifications v where v.job_id=new.id and v.user_id=new.user_id and v.passed
      and agentstack.verified_result_is_fresh(v.result,new.completion_contract) and v.output_hash=new.output_hash and v.contract_version=new.completion_contract->>'version') then
      raise exception 'verified completion requires a passing independent verification for this output and contract';
    end if;
    if not exists(select 1 from agentstack.job_artifacts a where a.job_id=new.id and a.user_id=new.user_id) then
      raise exception 'verified completion requires an artifact';
    end if;
  end if;
  return new;
end $$;
create or replace function agentstack.checkpoint_verified_job(p_job uuid,p_token uuid,p_step text,p_state jsonb,p_label text)
returns boolean language plpgsql security invoker set search_path=agentstack,pg_temp as $$
declare j agentstack.hybrid_missions;
begin
  select * into j from agentstack.hybrid_missions where id=p_job and lease_token=p_token and lease_expires_at>now() and status in ('running','verifying') for update;
  if j.id is null then return false; end if;
  insert into agentstack.job_checkpoints(job_id,user_id,step,state,lease_token) values(j.id,j.user_id,p_step,p_state,p_token)
    on conflict(job_id,step) do update set state=excluded.state,lease_token=excluded.lease_token,created_at=now();
  update agentstack.hybrid_mission_steps set status=case when p_state->>'stage'='finish' and p_state->'verification'->>'passed'='false' then 'failed' else 'completed' end,
    output=jsonb_build_object('checkpoint_step',p_step,'next_stage',p_state->>'stage'),finished_at=now()
    where mission_id=j.id and ordinal=case p_state->>'stage' when 'extract' then 0 when 'verify' then 1 when 'finish' then 2 else -1 end;
  if p_state->>'stage'='verify' and coalesce(p_state->'verification','null'::jsonb)='null'::jsonb then
    update agentstack.hybrid_mission_steps set status='queued',output=null,finished_at=null where mission_id=j.id and ordinal>=2;
  end if;
  insert into agentstack.job_events(job_id,user_id,event_type,label) values(j.id,j.user_id,'checkpoint_created',p_label);
  update agentstack.hybrid_missions set status='queued',lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
  return true;
end $$;
commit;
notify pgrst,'reload schema';

-- ========================================================================
-- 20261010095448_kryx_v2_private_execution_fields.sql
-- ========================================================================

begin;
-- Keep owned history readable while execution leases remain service-only.
-- Table-wide SELECT would override any column restriction, so revoke it first.
revoke select on agentstack.hybrid_missions from public,anon,authenticated;
grant select(id,user_id,workspace_key,instruction,requested_execution,selected_device_id,status,planner,summary,
  estimated_credits,credits_used,created_at,started_at,finished_at,updated_at,task_class,completion_contract,
  estimate_min,hard_cap,reserved_credits,is_free,receipt,output_hash,attempt,max_attempts,retry_at,next_run_at,
  request_key,blocker_category) on agentstack.hybrid_missions to authenticated;
revoke select on agentstack.job_checkpoints from public,anon,authenticated;
grant select(id,job_id,user_id,step,state,created_at) on agentstack.job_checkpoints to authenticated;
commit;
notify pgrst,'reload schema';
