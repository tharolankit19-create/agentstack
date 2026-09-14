
-- Founder interviews. All writes use the server; rewards require admin review.
create table agentstack.feedback_sessions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade unique,
 answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) <= 6),
 usage_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','submitted','rewarded','rejected')),
 version integer not null default 0,
 review_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 improvement_status text not null default 'new' check (improvement_status in ('new','planned','working','shipped','not_planned')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 submitted_at timestamptz,
 reviewed_at timestamptz
);
create index feedback_review_queue on agentstack.feedback_sessions(status, updated_at desc);
alter table agentstack.feedback_sessions enable row level security;
create policy feedback_owner_read on agentstack.feedback_sessions for select to authenticated using (user_id = auth.uid());
revoke all on agentstack.feedback_sessions from anon, authenticated;
grant select on agentstack.feedback_sessions to authenticated;
grant all on agentstack.feedback_sessions to service_role;

create table agentstack.feedback_rewards (
 user_id uuid primary key references auth.users(id) on delete cascade,
 session_id uuid not null unique references agentstack.feedback_sessions(id) on delete cascade,
 credits integer not null default 200 check (credits = 200),
 granted_at timestamptz not null default now()
);
alter table agentstack.feedback_rewards enable row level security;
create policy feedback_reward_owner_read on agentstack.feedback_rewards for select to authenticated using (user_id = auth.uid());
revoke all on agentstack.feedback_rewards from anon, authenticated;
grant select on agentstack.feedback_rewards to authenticated;
grant all on agentstack.feedback_rewards to service_role;

create table agentstack.feedback_reviews (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references agentstack.feedback_sessions(id) on delete cascade,
 reviewer_id uuid references auth.users(id) on delete set null,
 decision text not null,
 note text not null,
 improvement_status text not null,
 created_at timestamptz not null default now()
);
alter table agentstack.feedback_reviews enable row level security;
revoke all on agentstack.feedback_reviews from public, anon, authenticated;
grant all on agentstack.feedback_reviews to service_role;

-- Row lock makes retries/concurrent approvals idempotent; the grant, wallet,
-- audit and decision either all commit or all roll back. No client reward amount.
create or replace function agentstack.review_founder_feedback(
 p_session_id uuid, p_reviewer uuid, p_decision text, p_note text, p_improvement text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s agentstack.feedback_sessions; n integer;
begin
 if not exists(select 1 from agentstack.profiles where id=p_reviewer and is_admin=true) then
  raise exception 'Admin required';
 end if;
 if p_decision not in ('approve','reject','triage') or p_decision is null then raise exception 'Invalid decision'; end if;
 if p_improvement not in ('new','planned','working','shipped','not_planned') or p_improvement is null then raise exception 'Invalid triage'; end if;
 if length(btrim(coalesce(p_note,''))) < 8 or length(p_note)>2000 then raise exception 'Explain the decision'; end if;
 select * into s from agentstack.feedback_sessions where id=p_session_id for update;
 if not found then raise exception 'Feedback not found'; end if;
 insert into agentstack.feedback_reviews(session_id,reviewer_id,decision,note,improvement_status)
 values(s.id,p_reviewer,p_decision,p_note,p_improvement);
 if p_decision='triage' then
  update agentstack.feedback_sessions set improvement_status=p_improvement, review_note=p_note,
   reviewed_by=p_reviewer, reviewed_at=now(), updated_at=now() where id=s.id;
  return jsonb_build_object('status',s.status,'credits',0);
 end if;
 if s.status='rewarded' then return jsonb_build_object('status','rewarded','credits',200); end if;
 if s.status not in ('submitted','rejected') then raise exception 'Submit the interview first'; end if;
 if p_decision='approve' then
  if jsonb_array_length(s.answers)<>6 then raise exception 'Incomplete interview'; end if;
  insert into agentstack.feedback_rewards(user_id, session_id) values(s.user_id,s.id) on conflict do nothing;
  get diagnostics n = row_count;
  if n=1 then
   update agentstack.profiles set credit_balance=credit_balance+200 where id=s.user_id;
   if not found then raise exception 'Wallet missing'; end if;
   insert into agentstack.credit_topups(user_id,credits,paid_cents,provider,provider_ref)
    values(s.user_id,200,0,'feedback',s.id::text);
  end if;
 end if;
 update agentstack.feedback_sessions set
  status=case when p_decision='approve' then 'rewarded' else 'rejected' end,
  review_note=p_note, reviewed_by=p_reviewer, reviewed_at=now(),
  improvement_status=p_improvement, updated_at=now() where id=s.id;
 return jsonb_build_object('status',case when p_decision='approve' then 'rewarded' else 'rejected' end,
  'credits',case when p_decision='approve' then 200 else 0 end);
end $$;
revoke all on function agentstack.review_founder_feedback(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function agentstack.review_founder_feedback(uuid,uuid,text,text,text) to service_role;
