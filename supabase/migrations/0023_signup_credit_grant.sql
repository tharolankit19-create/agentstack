-- Make the starter wallet unambiguous and durable.
--
-- Every future account gets exactly 100 free Kryx credits ($1 of work) once,
-- at profile creation. Existing balances are never refilled by this migration.
-- Keeping the grant in the database trigger means Google OAuth, email signup,
-- and server-side profile creation all converge on the same rule.

alter table agentstack.profiles
  alter column credit_balance set default 100;

comment on column agentstack.profiles.credit_balance is
  'Prepaid Kryx credits. New profiles start with a one-time 100-credit starter grant; purchased credits never expire.';

create or replace function agentstack.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
begin
  insert into agentstack.profiles (
    id,
    email,
    full_name,
    avatar_url,
    credit_balance,
    credits_purchased,
    credits_spent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    100,
    0,
    0
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
