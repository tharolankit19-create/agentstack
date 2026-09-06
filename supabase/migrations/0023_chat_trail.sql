-- What the agent actually did, kept with what it said.
--
-- An agent that read four competitor pages and an agent that invented an answer
-- produced identical-looking replies. There was no way to tell them apart, so
-- the only rational reading of any reply was "this is probably generic" — which
-- is exactly the report that came back. The findings always went to the model;
-- nothing ever went to the person.
--
-- The trail is stored rather than computed at render time because it is a fact
-- about a moment: which pages were reachable on Tuesday afternoon is not
-- recoverable on Thursday, and a receipt that changes when you reload it is not
-- a receipt.

alter table agentstack.chat_messages
  -- [{kind: 'page'|'search'|'social', label, url?, ok}]. Small, and only ever
  -- written by the server.
  add column if not exists trail jsonb;

comment on column agentstack.chat_messages.trail is
  'What the agent searched and read to produce this reply. Shown to the founder.';

grant usage on schema agentstack to anon, authenticated, service_role;
grant all on all tables in schema agentstack to anon, authenticated, service_role;
grant all on all functions in schema agentstack to anon, authenticated, service_role;
