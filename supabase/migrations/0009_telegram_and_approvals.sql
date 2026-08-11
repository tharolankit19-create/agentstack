-- The founder's side of human-in-the-loop.
--
-- Two things the head agent needs before "reply 1 to approve" is real rather
-- than a line in a mockup: somewhere to record which Telegram chat belongs to
-- which account, and a flag on each piece of work saying whether it has been
-- approved.

-- ---------------------------------------------------------------------------
-- telegram_links
--
-- The chat id is the credential. Anyone messaging from a linked chat is
-- treated as the owner of that account, which is exactly as strong as the
-- founder's own Telegram account and no stronger — worth saying out loud,
-- since it means the linking step has to be deliberate rather than guessable.
--
-- Hence `link_code`: a short one-time code shown in the dashboard and pasted
-- into the bot. It expires, it is single-use, and until it is redeemed the
-- chat can do nothing at all.
-- ---------------------------------------------------------------------------

create table if not exists agentstack.telegram_links (
  user_id     uuid primary key references auth.users on delete cascade,
  chat_id     text unique,
  -- Null once redeemed. Its presence means "waiting to be connected".
  link_code   text unique,
  code_expires_at timestamptz,
  linked_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists telegram_links_chat_idx
  on agentstack.telegram_links (chat_id)
  where chat_id is not null;

alter table agentstack.telegram_links enable row level security;

-- The customer may see their own row so the dashboard can show the code and
-- whether it is connected. They may not write it: the code is issued by the
-- server and redeemed by the webhook, both service-role.
create policy "customers may read their own telegram link"
  on agentstack.telegram_links for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Approval on generated work
--
-- Default false, deliberately. Every draft starts unapproved, so a bug that
-- forgets to ask cannot result in something being published — the failure mode
-- is silence, which is recoverable, rather than an unwanted post, which is not.
-- ---------------------------------------------------------------------------

alter table agentstack.generations
  add column if not exists approved boolean not null default false,
  add column if not exists approved_at timestamptz;

comment on column agentstack.generations.approved is
  'False until the founder says otherwise. Nothing publishes or sends without it.';

create index if not exists generations_pending_idx
  on agentstack.generations (user_id, created_at desc)
  where approved = false;

-- Customers approve from the dashboard as well as from Telegram, so the
-- update policy allows it — but only on their own rows, and only the approval
-- columns are worth changing here.
drop policy if exists "customers may approve their own generations" on agentstack.generations;

create policy "customers may approve their own generations"
  on agentstack.generations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
