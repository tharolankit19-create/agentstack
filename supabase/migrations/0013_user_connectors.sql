-- Connectors: the founder's own keys to the outside world, in one place.
--
-- The army can reach further when the founder plugs in a few keys of their own —
-- Firecrawl so the research squad reads live pages, X (via Xquik) so it watches
-- and posts, Apollo so outreach finds real people, Resend so email actually
-- sends. Asking for these one agent at a time is friction; this is the one
-- place they live, encrypted, and every consumer reads from here.
--
-- One row per founder. All the keys ride inside a single AES-256-GCM envelope
-- (`ciphertext`) exactly like agent_secrets — a database dump yields nothing.
-- `keys` lists which connector ids are set, so the dashboard can show what is
-- connected without ever decrypting, and the browser never touches ciphertext:
-- the app reads and writes it through the service role only.

create table if not exists agentstack.user_connectors (
  user_id     uuid primary key references auth.users on delete cascade,
  -- The sealed map of connector-id -> key. Never sent to a browser.
  ciphertext  text not null,
  -- Which connectors have a key on file. Display-only, safe to read.
  keys        text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table agentstack.user_connectors enable row level security;

-- The founder may see which connectors they have wired. The ciphertext column
-- exists on the row but the app never selects it client-side; even if it did,
-- it is encrypted with a key that lives only in the platform environment.
create policy "owners read their connectors"
  on agentstack.user_connectors for select
  using (auth.uid() = user_id);

-- Everything else is written by the service role: the connectors API opens the
-- envelope, merges the new key in, and re-seals it. A customer writing
-- ciphertext directly is a customer writing arbitrary bytes into a field the
-- deploy pipeline decrypts, so writes stay server-side.

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
