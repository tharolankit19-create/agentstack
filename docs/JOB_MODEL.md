# Job model (implemented rollout)

V2 promotes `hybrid_missions` into Jobs rather than replacing mission history. Legacy rows have `task_class = NULL`. V2 rows have `planner.engine = verified_jobs_v2`, a versioned completion contract, an estimate, cap, reservation, lease, and final receipt. Legacy advancement explicitly excludes the V2 marker. No data is deleted.

`create_verified_job` atomically creates the job, four dependent `hybrid_mission_steps`, initial conversation, and event. Request keys are unique per owner. The four current steps are source discovery, identity extraction, independent verification, and delivery/settlement. Discovery fans out at most three public source reads at a time. This is a deterministic Lead List procedure, not a universal planning model.

Messages, events, artifacts, verification, checkpoints, usage, and accounting are separate owned records. Composite `(job_id,user_id)` foreign keys bind new child records to the correct owner. Existing `task_evidence` and `action_approvals` remain available. Worker runs are identified in usage and checkpoints; there is no separate WorkerRun table in this slice.

The founder sees one job thread with human progress, artifacts, verification, and the receipt. New Task / Working / Needs You / Finished / Scheduled / You replace agent navigation under `KRYX_V2_JOBS`. Legacy deep links still work. Jobs persist after navigation and tab closure. `next_run_at` is a reserved field; V2 recurring creation is not implemented yet.

States are shared in `lib/jobs/types.ts`. Only service-only SQL functions mutate financial/queue state. Completion is guarded at the database and must pass `complete_verified_job`; returning model prose cannot complete a V2 job. Pause and cancellation invalidate leases. Resume continues from the durable checkpoint. Cancel releases the reservation. Unsupported classes are rejected during creation, rather than producing an unusable job.

Workspace context currently belongs to a founder's head-agent config. The adapter retrieves selected product/ICP/voice/claims fields, not all history. Multi-user workspace membership, correction learning, procedural memory, and reusable V2 Skills are later phases.
