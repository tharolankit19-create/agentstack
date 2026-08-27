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
