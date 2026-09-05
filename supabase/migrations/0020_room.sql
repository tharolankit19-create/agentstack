-- The room.
--
-- The squads have always worked in isolation: each agent runs, files what it
-- produced, and never sees what anyone else did. The head agent reads all of it
-- afterwards and summarises — which is coordination after the fact, and by then
-- the SEO agent has already written a post about a competitor claim the
-- competitor agent disproved that morning.
--
-- A room is one shared thread per founder. Agents post what they found when it
-- is worth another agent knowing, the head agent directs, and the founder can
-- read it or step in and @mention anyone. Nobody is autonomous here — an agent
-- speaks when it has just done work, never in a loop with another agent, which
-- is the failure mode that turns multi-agent chat into two machines talking to
-- each other until the budget runs out.

create table if not exists agentstack.room_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Who spoke. Null author means the founder — they are a person, not an agent,
  -- and giving them a fake agent row to satisfy a foreign key would put them in
  -- every "which agents are active" count.
  agent_id uuid references agentstack.agents (id) on delete set null,
  template_id text,

  body text not null,

  -- Who this was addressed to, when it was addressed to anyone. Drives the
  -- unread badge on an agent, and stops a broadcast from waking all thirteen.
  mentions text[] not null default '{}',

  -- What prompted it, so a line in the room can be opened.
  generation_id uuid references agentstack.generations (id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists room_messages_user_idx
  on agentstack.room_messages (user_id, created_at desc);

alter table agentstack.room_messages enable row level security;

-- The founder reads their own room and can post into it. Agents write through
-- the service role: a browser session that could post as an agent could put
-- words in a squad member's mouth, and the whole value of the room is that what
-- an agent says there is what it actually did.
create policy "owners read their room"
  on agentstack.room_messages for select
  using (auth.uid() = user_id);

create policy "owners speak in their room"
  on agentstack.room_messages for insert
  with check (auth.uid() = user_id and agent_id is null);

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
