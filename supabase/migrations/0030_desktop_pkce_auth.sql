-- Kryx Desktop V1.2 — Phase 3: authorization-code + PKCE bridge.
--
-- The founder authenticates in the normal Kryx web app (including Google).
-- Desktop never receives a Google password or browser cookie. Approval produces
-- a one-time code bound to the desktop's PKCE verifier.

alter table agentstack.device_sessions
  add column if not exists refresh_token_hash text,
  add column if not exists refresh_expires_at timestamptz;

create index if not exists device_sessions_refresh_idx
  on agentstack.device_sessions(id, refresh_expires_at)
  where revoked_at is null;


create table if not exists agentstack.desktop_auth_requests (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 120),
  platform text not null check (platform in ('macos','windows','linux','android')),
  os_version text,
  app_version text,
  capabilities jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  public_key text,

  -- OAuth-style CSRF + PKCE values. State is safe to persist; it is not an
  -- authentication credential. The code itself is never persisted, only hash.
  state text not null check (char_length(state) between 24 and 256),
  code_challenge text not null check (char_length(code_challenge) between 43 and 128),
  redirect_uri text not null default 'kryx://auth/callback',

  user_id uuid references auth.users(id) on delete cascade,
  code_hash text check (code_hash is null or char_length(code_hash) = 64),
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists desktop_auth_requests_expiry_idx
  on agentstack.desktop_auth_requests(expires_at)
  where consumed_at is null;

alter table agentstack.desktop_auth_requests enable row level security;

-- These rows are part of the authorization protocol and never exposed through
-- PostgREST to browsers or desktop clients.
revoke all on agentstack.desktop_auth_requests from public, anon, authenticated;
grant all on agentstack.desktop_auth_requests to service_role;

notify pgrst, 'reload schema';
