# Recovery engine

The queue claims one job with `FOR UPDATE SKIP LOCKED`, a fresh token, and a six-minute lease. A valid lease excludes a second worker. Expired leases permit takeover. Checkpoints, usage finalization, result/artifact storage, and settlement reject stale tokens. Pause/cancel revoke the token, so a later response cannot finalize cancelled work.

The pipeline persists source discovery, candidate extraction, independent verification, and delivery checkpoints. An invocation advances up to four claimed stages/jobs within a bounded time budget. A new process reads the latest checkpoint, not process memory. Source text, sources, output, worker run ID, and billable operation keys are retained. The job reservation and retry counts are stored on the job.

Failures are classified in `recovery.ts`. Provider/model/network/source/output/verification failures use a bounded retry budget of three attempts and delayed retries. Routing rotates the configured candidate pool on subsequent attempts and tries at most two providers per call. A failed verification rewinds extraction/verification while retaining the successful source checkpoint and its operation keys. Invalid extraction is retried with a rotated route. There is no selector repair or cloud-browser recovery in this slice.

CAPTCHA, 2FA, expired authorization, missing configuration, and hard-cap exhaustion pause in Needs You. They are not bypassed. Resume does not raise the cap or grant permissions. Terminal failures return the whole remaining reservation with an accounting record; founder-facing completion cost remains zero.

Actual public source strategies are logged in `reliability_ledger` with outcome, method, failure category, latency, attempt, and work units. This dataset is a foundation. Adaptive strategy ranking, full provider telemetry aggregation, and an admin reliability dashboard are not implemented yet.

The existing heartbeat dispatches the jobs worker, and authenticated start/resume also launches server-side work through Next.js `after`. Cron returns acceptance promptly; the callback performs work after the response. Continued execution depends on a functioning heartbeat or worker deployment. Local fixtures do not prove production clock uptime.
