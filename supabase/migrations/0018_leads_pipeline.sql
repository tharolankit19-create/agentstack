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
