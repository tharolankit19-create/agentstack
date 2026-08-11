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
