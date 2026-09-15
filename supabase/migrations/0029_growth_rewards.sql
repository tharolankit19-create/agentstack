-- Kryx growth rewards.
-- Manual review only. Never trust self-reported impressions enough to auto-credit.

create table if not exists agentstack.growth_reward_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'x' check (platform = 'x'),
  post_url text not null,
  claimed_impressions integer not null check (claimed_impressions >= 0),
  reward_credits integer not null check (reward_credits in (100, 250, 500)),
  status text not null default 'submitted'
    check (status in ('submitted','approved','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_url)
);

create index if not exists growth_reward_user_idx
  on agentstack.growth_reward_submissions(user_id, created_at desc);

alter table agentstack.growth_reward_submissions enable row level security;

drop policy if exists "owners read growth reward submissions"
  on agentstack.growth_reward_submissions;
create policy "owners read growth reward submissions"
  on agentstack.growth_reward_submissions
  for select
  using (auth.uid() = user_id);

revoke all on agentstack.growth_reward_submissions from anon, authenticated;
grant select on agentstack.growth_reward_submissions to authenticated;
grant all on agentstack.growth_reward_submissions to service_role;

create or replace function agentstack.review_growth_reward(
  p_submission_id uuid,
  p_reviewer uuid,
  p_decision text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = agentstack, pg_temp
as $$
declare
  item agentstack.growth_reward_submissions;
  inserted_id uuid;
begin
  if not exists (
    select 1 from agentstack.profiles
    where id = p_reviewer and is_admin = true
  ) then
    raise exception 'Admin required';
  end if;

  if p_decision not in ('approve','reject') then
    raise exception 'Invalid decision';
  end if;

  select * into item
  from agentstack.growth_reward_submissions
  where id = p_submission_id
  for update;

  if not found then raise exception 'Submission not found'; end if;

  if item.status = 'approved' then
    return jsonb_build_object('status','approved','credits',item.reward_credits);
  end if;

  if p_decision = 'approve' then
    insert into agentstack.credit_topups(
      user_id, credits, paid_cents, provider, provider_ref
    )
    values (
      item.user_id,
      item.reward_credits,
      0,
      'growth_reward',
      item.id::text
    )
    on conflict (provider, provider_ref) do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update agentstack.profiles
      set credit_balance = credit_balance + item.reward_credits
      where id = item.user_id;
    end if;
  end if;

  update agentstack.growth_reward_submissions
  set
    status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
    review_note = nullif(trim(p_note),''),
    reviewed_by = p_reviewer,
    reviewed_at = now()
  where id = item.id;

  return jsonb_build_object(
    'status', case when p_decision = 'approve' then 'approved' else 'rejected' end,
    'credits', case when p_decision = 'approve' then item.reward_credits else 0 end
  );
end;
$$;

revoke all on function agentstack.review_growth_reward(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function agentstack.review_growth_reward(uuid,uuid,text,text)
  to service_role;

notify pgrst, 'reload schema';
