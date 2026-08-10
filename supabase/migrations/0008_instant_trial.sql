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
