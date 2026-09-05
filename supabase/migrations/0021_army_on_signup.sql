-- The army exists because the account exists.
--
-- Three things stood between a new signup and a working army, and all three
-- were left over from the subscription model that 0019 replaced:
--
--   1. `is_entitled` asked whether a *subscription* was live. Under credits
--      there is no subscription, so every new account was permanently
--      unentitled — the Telegram webhook refused it, the crons skipped it, and
--      the agent-insert trigger raised "No active plan."
--   2. `agent_quota` defaulted to 0 and was only raised by the payment
--      webhook, so even an entitled account could hold no agents.
--   3. Nothing created the roster. The founder had to find a button.
--
-- This migration fixes the first two. The third is application code — the
-- roster's names live in `lib/army.ts` and belong in one place, not copied
-- into plpgsql where they would drift the first time a squad changes.
--
-- What gates the product now is the credit balance, exactly as 0019 said it
-- would: "Credits bought and not yet spent. Never expires. The only gate on
-- running agents." Everything below makes that sentence true.

-- ---------------------------------------------------------------------------
-- One row per template per founder.
--
-- Enlistment can be triggered by two things at once — the auth callback and
-- the first dashboard load, in two tabs — and without this a founder ends up
-- with two Seamuses. `custom-agent` is excluded because every agent built from
-- a pasted URL carries that same template id by design, and a founder may have
-- several.
-- ---------------------------------------------------------------------------
delete from agentstack.agents a
where a.template_id <> 'custom-agent'
  and exists (
    select 1 from agentstack.agents b
     where b.user_id = a.user_id
       and b.template_id = a.template_id
       and (b.created_at, b.id) < (a.created_at, a.id)
  );

create unique index if not exists agents_one_per_template_idx
  on agentstack.agents (user_id, template_id)
  where template_id <> 'custom-agent';

-- ---------------------------------------------------------------------------
-- Entitlement is a balance, not a subscription.
--
-- The legacy clauses stay because accounts that bought a plan before credits
-- existed are still owed what they paid for. New accounts arrive with the
-- signup credits from 0019, so they are entitled from their first second and
-- stop being entitled when they run out and choose not to top up. That is the
-- whole business model expressed as one boolean.
-- ---------------------------------------------------------------------------
create or replace function agentstack.is_entitled(p agentstack.profiles)
returns boolean
language sql
stable
as $$
  select
    coalesce(p.is_admin, false)
    or coalesce(p.credit_balance, 0) > 0
    or (p.plan <> 'none' and p.subscription_status = 'active')
    or (p.plan <> 'none' and p.trial_ends_at is not null and p.trial_ends_at > now())
$$;

-- ---------------------------------------------------------------------------
-- The ceiling is a runaway guard, not a plan feature.
--
-- Under credits, holding an agent costs nothing — running one costs credits.
-- So the count is no longer something to sell, and capping it at three would
-- only mean the founder gets three of the twenty-five agents they were shown.
-- What remains worth stopping is a loop that inserts forever, which is what
-- this number is for.
-- ---------------------------------------------------------------------------
alter table agentstack.profiles alter column agent_quota set default 60;

update agentstack.profiles set agent_quota = 60 where agent_quota < 60;

comment on column agentstack.profiles.agent_quota is
  'Runaway guard on how many agent rows one account may hold. Not a plan limit — '
  'running an agent costs credits, holding one does not.';

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

  -- Deliberately no entitlement check. Creating an agent is free; running one
  -- spends credits, and `spend_credits` is where an empty balance stops the
  -- work. Refusing the row instead would mean a founder who ran out of credits
  -- comes back to an empty dashboard rather than a paused one.
  select count(*) into used from agentstack.agents where user_id = new.user_id;

  if used >= greatest(prof.agent_quota, 60) then
    raise exception 'Agent limit reached (% of %).', used, greatest(prof.agent_quota, 60)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
