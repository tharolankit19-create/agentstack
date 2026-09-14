
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema agentstack;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,agentstack to authenticated,anon,service_role;
create table auth.users(id uuid primary key);
create table agentstack.profiles(id uuid primary key references auth.users, is_admin boolean default false, credit_balance integer default 100);
create table agentstack.credit_topups(id uuid default gen_random_uuid(),user_id uuid,credits integer,paid_cents integer,provider text,provider_ref text,unique(provider,provider_ref));
\ir ../supabase/migrations/0023_founder_feedback.sql
insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into agentstack.profiles(id,is_admin) values('00000000-0000-0000-0000-000000000001',true),('00000000-0000-0000-0000-000000000002',false);
insert into agentstack.feedback_sessions(id,user_id,status,answers) values
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','submitted',
 '[{"question":"goal","answer":"Publish a launch post"},{"question":"task","answer":"I tried room chat but no reply came"},{"question":"edit","answer":"Had to retry twice"},{"question":"alternative","answer":"Wrote it myself"},{"question":"priority","answer":"Fix the chat timeout"},{"question":"keep","answer":"Nothing yet"}]'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','submitted',
 '[{"question":"goal","answer":"a"},{"question":"task","answer":"b"},{"question":"edit","answer":"c"},{"question":"alternative","answer":"d"},{"question":"priority","answer":"e"},{"question":"keep","answer":"f"}]');
do $$
begin
 if has_function_privilege('anon','agentstack.review_founder_feedback(uuid,uuid,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','agentstack.review_founder_feedback(uuid,uuid,text,text,text)','EXECUTE')
 then raise exception 'Clients can grant credits'; end if;
 if has_table_privilege('authenticated','agentstack.feedback_sessions','UPDATE') then raise exception 'Client can edit submitted answers'; end if;
 begin
  perform agentstack.review_founder_feedback('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','approve','valid concrete feedback','new');
  raise exception 'Nonadmin accepted';
 exception when raise_exception then
  if sqlerrm <> 'Admin required' then raise; end if;
 end;
 begin
  perform agentstack.review_founder_feedback('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','approve','valid concrete feedback','new');
  raise exception 'Missing wallet accepted';
 exception when raise_exception then
  if sqlerrm <> 'Wallet missing' then raise; end if;
 end;
 if exists(select 1 from agentstack.feedback_rewards) then raise exception 'Failed award did not roll back'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select count(*) from agentstack.feedback_sessions)<>1 then raise exception 'Cross-user feedback leak'; end if;
end $$;
reset role;
-- Two parallel approvals are launched by CI after this fixture.
