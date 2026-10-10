# V2 migration and rollout

The repository baseline is `8ee2319`. The new migrations are:

1. `20261008172940_kryx_v2_jobs.sql` — extends hybrid missions/steps; adds missing owned job records; completion trigger; transactional creation and step dependencies.
2. `20261008173458_kryx_v2_execution.sql` — fenced queue, checkpoints, retry/rewind, failure handling, jobs heartbeat registration.
3. `20261008173751_kryx_v2_accounting.sql` — reserve/start/control, bounded operations, transactional verified settlement.
4. `20261008175055_kryx_v2_result_fencing.sql` — atomic fenced verification/artifact persistence.
5. `20261010085050_kryx_v2_resumable_progress.sql` — fenced in-flight source batches, verifier rewind and real source-discovery retry.
6. `20261010085739_kryx_v2_cap_resume.sql` — blocker metadata and transactional, explicitly approved cap increases with immutable ledger entries.
7. `20261010092918_kryx_v2_proof_expiry.sql` — source-proof expiry at result persistence, settlement and direct completion, plus safe verifier-step rewind.
8. `20261010095448_kryx_v2_private_execution_fields.sql` — column grants keep execution leases private while owners retain history and checkpoint-state reads.

The earlier `0031_hybrid_device_tasks.sql` also fixes its missing `device_tasks.created_at` column before an index references it. Existing task rows are retained.

Use the actual Kryx Supabase project and its existing `agentstack` schema. Never install this on a similarly named or unrelated project. The connected healthy project observed during this session contains SaaSGrave tables; no production mutation was made.

Apply the additive migrations through the project's normal reviewed deployment flow, with all V2 flags false. Ensure prerequisite hybrid/profile/cron migrations exist. Local tests run actual `0031` plus V2 SQL over minimal prerequisite tables in PGlite. CI runs the same SQL against disposable PostgreSQL 16 with concurrent cap/reservation-return checks. Neither simulates the complete Supabase service or validates every historical migration. Repeat migration/advisor/RLS checks on the actual staging project. Files under `tests/fixtures` are disposable test setup, never deployment migrations.

After migration 8, authenticated Data API clients must select explicit public columns from `hybrid_missions` and `job_checkpoints`; `SELECT *` and lease-column reads fail. Server workers retain service-role access. Repository legacy mission APIs use the existing planner field to fence V2 jobs without depending on new columns before migration, and preserve readable legacy history.

Set the existing Supabase server credentials, encryption key, configured model routing credentials, and Firecrawl key (or founder connector). Never put server keys in `NEXT_PUBLIC_*` or commit them. A public source URL job may bypass search discovery, but both worker and independent model verification still require configured routes.

Enable `KRYX_V2_JOBS`, `KRYX_VERIFICATION`, and `KRYX_FAILURE_REFUNDS` together for a controlled test environment. Verify the heartbeat reaches `/api/cron/jobs`. Other classes are intentionally rejected. Keep `KRYX_BROWSER_WATCH` and `KRYX_NEW_LANDING` off; those surfaces are not shipped.

Run a real 20-founder job, inspect raw source snapshots and CSV, force verification/provider failures, verify wallet ledgers, then test restart/pause/cancel/concurrency with actual authenticated accounts. Only after that passes should later phases begin. The requested five-class coverage, browser/Watch, $49 plan, 50 real jobs, false-positive/retry-economics measurements, and public beta gates remain pending.

Rollback is flag-based and additive. Turning flags off preserves all records. Existing mission advancement excludes the V2 engine marker, so it cannot pick up those jobs and apply legacy text-as-success logic. Paused V2 work remains durable for re-enablement. Do not drop tables or reset balances for rollback.
