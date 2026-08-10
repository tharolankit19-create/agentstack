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
