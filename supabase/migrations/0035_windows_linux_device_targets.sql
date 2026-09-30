-- Extend Kryx hybrid execution targets to Windows and Linux.
alter table agentstack.hybrid_missions
  drop constraint if exists hybrid_missions_requested_execution_check;

alter table agentstack.hybrid_missions
  add constraint hybrid_missions_requested_execution_check
  check (requested_execution in ('auto','cloud','macos','windows','linux','android'));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'agentstack'
      and table_name = 'scheduled_tasks'
      and column_name = 'execution_target'
  ) then
    alter table agentstack.scheduled_tasks
      drop constraint if exists scheduled_tasks_execution_target_check;
    alter table agentstack.scheduled_tasks
      add constraint scheduled_tasks_execution_target_check
      check (execution_target in ('auto','cloud','macos','windows','linux','android'));
  end if;
end $$;

notify pgrst, 'reload schema';
