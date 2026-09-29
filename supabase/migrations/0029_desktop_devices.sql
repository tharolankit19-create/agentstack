-- Kryx Desktop V1.2 — Phase 2: device identity and revocable sessions.
-- Additive only. Does not alter existing agents, missions, credits, billing or auth.
--
-- Device registration is performed by a server route after validating the
-- founder's Supabase access token. The plaintext device token is returned once,
-- stored in macOS Keychain, and never stored in Postgres.

create table if not exists agentstack.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 120),
  platform text not null check (platform in ('macos','windows','linux','android')),
  os_version text,
  app_version text,
  status text not null default 'offline'
    check (status in ('online','offline','revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  public_key text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, installation_id)
);

create index if not exists devices_user_status_idx
  on agentstack.devices(user_id, status, last_seen_at desc);

alter table agentstack.devices enable row level security;

drop policy if exists "owners read their devices" on agentstack.devices;
create policy "owners read their devices"
  on agentstack.devices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Device writes go through server routes so revocation, token invalidation and
-- the audit trail cannot be bypassed with a direct REST call.
revoke insert, update, delete on agentstack.devices from anon, authenticated;
grant select on agentstack.devices to authenticated;
grant all on agentstack.devices to service_role;


create table if not exists agentstack.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references agentstack.devices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  user_agent text
);

create index if not exists device_sessions_active_idx
  on agentstack.device_sessions(device_id, expires_at desc)
  where revoked_at is null;

create index if not exists device_sessions_user_idx
  on agentstack.device_sessions(user_id, created_at desc);

alter table agentstack.device_sessions enable row level security;

-- Token hashes are server-only. The dashboard does not need them to render the
-- Devices page.
revoke all on agentstack.device_sessions from public, anon, authenticated;
grant all on agentstack.device_sessions to service_role;


create table if not exists agentstack.device_auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references agentstack.devices(id) on delete set null,
  session_id uuid references agentstack.device_sessions(id) on delete set null,
  event text not null check (event in (
    'registered',
    'session_issued',
    'session_refreshed',
    'heartbeat',
    'renamed',
    'revoked',
    'auth_failed'
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_auth_events_user_idx
  on agentstack.device_auth_events(user_id, created_at desc);

alter table agentstack.device_auth_events enable row level security;

drop policy if exists "owners read device auth events" on agentstack.device_auth_events;
create policy "owners read device auth events"
  on agentstack.device_auth_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on agentstack.device_auth_events from anon, authenticated;
grant select on agentstack.device_auth_events to authenticated;
grant all on agentstack.device_auth_events to service_role;


-- Revocation is intentionally atomic: once the device is marked revoked every
-- active device credential is invalidated in the same transaction.
create or replace function agentstack.revoke_device(
  p_user_id uuid,
  p_device_id uuid,
  p_reason text default 'user_revoked'
)
returns boolean
language plpgsql
security invoker
set search_path = agentstack, pg_temp
as $$
declare
  changed integer;
begin
  update agentstack.devices
  set status = 'revoked',
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where id = p_device_id
    and user_id = p_user_id
    and revoked_at is null;

  get diagnostics changed = row_count;
  if changed = 0 then return false; end if;

  update agentstack.device_sessions
  set revoked_at = coalesce(revoked_at, now()),
      revoke_reason = coalesce(revoke_reason, p_reason)
  where device_id = p_device_id
    and user_id = p_user_id
    and revoked_at is null;

  return true;
end;
$$;

revoke all on function agentstack.revoke_device(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function agentstack.revoke_device(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
