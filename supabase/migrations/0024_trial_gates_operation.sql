-- Credits meter usage; the plan decides whether anything runs at all.
--
-- 0021 made a credit balance the definition of entitled, which had the side
-- effect nobody asked for: every free signup arrived with the signup credits
-- and was therefore a fully operating account. A free tier that runs the whole
-- product is not a free tier.
--
-- So the two questions are separated again, because they were never the same
-- one. *May this account run anything* is answered by a plan — a live
-- subscription, or a trial that has not expired. *How much may it run* is
-- answered by the credit balance, inside `spend_credits`, which is untouched.
--
-- A free account keeps everything that costs us nothing: the board, the room,
-- the roster, Telegram, its brand and competitors. It cannot spend our API
-- budget, which is the only thing the gate was ever protecting.

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

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
