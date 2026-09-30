-- Workflow review and shadow-mode state.
alter table agentstack.detected_workflows
  add column if not exists mode text not null default 'observe',
  add column if not exists shadow_runs integer not null default 0,
  add column if not exists last_shadow_result jsonb;

alter table agentstack.detected_workflows
  drop constraint if exists detected_workflows_mode_check;
alter table agentstack.detected_workflows
  add constraint detected_workflows_mode_check
  check (mode in ('observe','shadow','assist','run_with_approvals','autopilot'));

notify pgrst, 'reload schema';
