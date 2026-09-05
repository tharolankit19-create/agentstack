-- Fifty leads every morning, and the reason it was never going to happen.
--
-- The pipeline searched with one string — the founder's ICP, verbatim, every
-- tick — and wrote the results with `ignore_duplicates`. A vendor asked the
-- same question twice returns the same first page twice, so the first tick
-- added twenty-five leads and every tick after it added none, at full price.
-- The shortfall never closed. It could not: the query never changed.
--
-- A human sourcing leads does not ask one question fifty times. They ask a
-- dozen narrower ones — this title, that city, this vertical, that company
-- size — and the union of the answers is the list. This table is that dozen,
-- kept per founder, rotated least-recently-used, and scored by what each one
-- actually returned so the ones that find nobody stop costing money.

create table if not exists agentstack.lead_angles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- The search string itself. One narrow slice of the founder's ICP.
  angle        text not null,
  -- How the angle came to exist, for the founder's own audit: 'derived' from
  -- their site by the model, or 'icp' — the plain profile, always kept as the
  -- fallback so a founder whose derivation fails still gets a search.
  origin       text not null default 'derived',
  uses         integer not null default 0,
  -- Leads this angle has produced that were not already in the table. The only
  -- number that matters: an angle with uses and no yield is a bill.
  yield        integer not null default 0,
  -- Consecutive runs that found nothing new. Three retires the angle.
  dry_streak   integer not null default 0,
  retired_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, angle)
);

create index if not exists lead_angles_rotation_idx
  on agentstack.lead_angles (user_id, last_used_at nulls first)
  where retired_at is null;

alter table agentstack.lead_angles enable row level security;

create policy "owners read their search angles"
  on agentstack.lead_angles for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- "Today" is the founder's today.
--
-- The target was counted from UTC midnight, which in Delhi means the day rolls
-- over at half past five in the morning — leads found at 5am counted against
-- yesterday's fifty, and the founder woke to a target that had just reset.
-- The promise is "fifty by the time you get up", so the day has to be the one
-- they are actually living in.
-- ---------------------------------------------------------------------------
create or replace function agentstack.found_today(p_user_id uuid, p_timezone text default 'UTC')
returns int
language sql
stable
as $$
  select count(*)::int
    from agentstack.leads
   where user_id = p_user_id
     and (created_at at time zone p_timezone)::date = (now() at time zone p_timezone)::date;
$$;

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
