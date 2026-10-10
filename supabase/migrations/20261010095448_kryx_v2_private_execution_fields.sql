begin;
-- Keep owned history readable while execution leases remain service-only.
-- Table-wide SELECT would override any column restriction, so revoke it first.
revoke select on agentstack.hybrid_missions from public,anon,authenticated;
grant select(id,user_id,workspace_key,instruction,requested_execution,selected_device_id,status,planner,summary,
  estimated_credits,credits_used,created_at,started_at,finished_at,updated_at,task_class,completion_contract,
  estimate_min,hard_cap,reserved_credits,is_free,receipt,output_hash,attempt,max_attempts,retry_at,next_run_at,
  request_key,blocker_category) on agentstack.hybrid_missions to authenticated;
revoke select on agentstack.job_checkpoints from public,anon,authenticated;
grant select(id,job_id,user_id,step,state,created_at) on agentstack.job_checkpoints to authenticated;
commit;
notify pgrst,'reload schema';
