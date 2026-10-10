-- Test-only prerequisites for a disposable database. Never apply to production.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,service_role;
 create schema agentstack; grant usage on schema agentstack to authenticated,service_role;
 create table agentstack.profiles(id uuid primary key references auth.users,credit_balance integer not null default 500,credits_spent integer not null default 0);
 create table agentstack.cron_ticks(worker text primary key,last_run_at timestamptz); create table agentstack.agents(id uuid primary key); create table agentstack.devices(id uuid primary key);
 grant all on all tables in schema agentstack to service_role;
 insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'); insert into agentstack.profiles(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
