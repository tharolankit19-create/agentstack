-- AgentStack — onboarding.
--
-- The dashboard now opens for anyone who has signed up and answered four
-- questions. Payment is enforced at the moment of action instead of at the
-- door: someone who cannot see what they are buying does not buy it.
--
-- What we ask is chosen to be useful on both sides. The customer's monthly
-- spend and current tools drive which agents we put in front of them first,
-- and the problem they picked is the sentence we lead their dashboard with.

alter table public.profiles
  add column onboarded_at    timestamptz,
  add column company         text,
  -- Which problems brought them here. Free-form on purpose — the options can
  -- change without a migration.
  add column problems        text[] not null default '{}',
  -- What they told us they spend on SaaS each month, in USD.
  add column monthly_spend   integer,
  -- Tools they said they pay for. Optional; drives the agent ordering.
  add column current_tools   text[] not null default '{}';

comment on column public.profiles.onboarded_at is
  'Null until the customer has finished onboarding. Gates the dashboard.';

-- Customers fill these in themselves, so the update policy has to allow it —
-- while still refusing any change to plan or agent_quota, which only the
-- payment webhook may touch.
drop policy if exists "owners may edit their own profile fields" on public.profiles;

create policy "owners may edit their own profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from public.profiles p where p.id = auth.uid())
    and agent_quota = (select p.agent_quota from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Self-healing profiles
--
-- The signup trigger creates a profile row, but a row can still be missing —
-- a user created before the trigger existed, or a restore. Without this the
-- app used to bounce such a user between /login and /dashboard forever.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_profile(user_id uuid, user_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.profiles;
begin
  insert into public.profiles (id, email)
  values (user_id, user_email)
  on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email)
  returning * into result;

  return result;
end;
$$;

revoke all on function public.ensure_profile(uuid, text) from public;
grant execute on function public.ensure_profile(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Support conversations
--
-- The floating helper keeps its history so a founder can close the tab and
-- come back to the same conversation.
-- ---------------------------------------------------------------------------

create table public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index support_messages_user_idx on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;

create policy "customers may read their own support chat"
  on public.support_messages for select
  using (auth.uid() = user_id);

create policy "customers may clear their own support chat"
  on public.support_messages for delete
  using (auth.uid() = user_id);
