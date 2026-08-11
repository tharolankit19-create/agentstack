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
