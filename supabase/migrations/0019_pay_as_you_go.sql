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
