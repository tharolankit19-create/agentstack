-- One-time signup credit grant.
--
-- 100 Kryx credits = $1 customer-facing. New profiles start with 100 credits
-- once; purchased credits still never expire. This migration deliberately does
-- not change plan, trial, quota, or subscription behavior.

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
    credit_balance
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    100
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
