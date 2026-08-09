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

alter type public.plan_tier add value if not exists 'unlimited';

comment on type public.plan_tier is
  'none = signed up, never paid. starter = 3 agents, self-hosted. '
  'pro = 10 agents, we host them. unlimited = no cap, self-hosted.';
