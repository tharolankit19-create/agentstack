# Recovery engine

The queue claims one job with `FOR UPDATE SKIP LOCKED`, a fresh token, and a six-minute lease. A valid lease excludes a second worker. Expired leases permit takeover. Checkpoints, usage finalization, result/artifact storage, and settlement reject stale tokens. Pause/cancel revoke the token, so a later response cannot finalize cancelled work.

The pipeline persists source discovery, candidate extraction, independent verification, and delivery checkpoints. Source URLs and completed batches are saved under the active lease before moving to the next batch. Independently read sources retain a distinct verifier run ID and cursor. A blocker preserves successful peers in its batch. Process takeover skips completed source reads and resumes pending work.

An invocation advances up to four claimed stages/jobs within a 250-second time budget. It yields with a safe checkpoint when fewer than 120 seconds remain, leaving room for bounded provider failover. Each public source has one 30-second total deadline across DNS, redirects and response streaming, plus an inactivity timeout. A new process reads the latest checkpoint, not process memory. Source text, sources, output, worker run ID, and contributing operation keys are retained. Reservations and retry counters remain on the job.

Failures are classified in `recovery.ts`. Provider/model/network/source/output/verification failures use a bounded retry budget of three attempts and delayed retries. Routing rotates the configured candidate pool on subsequent attempts and tries at most two providers per call. A failed verification rewinds extraction/verification while retaining the successful source checkpoint and its operation keys. Invalid extraction is retried with a rotated route. There is no selector repair or cloud-browser recovery in this slice.

CAPTCHA, 2FA, expired authorization, missing configuration, and hard-cap exhaustion pause in Needs You with a persisted blocker category. They are not bypassed. Resume may include an explicit founder-approved cap increase; it never grants additional tool permissions. Terminal failures return the whole remaining reservation with an accounting record; founder-facing completion cost remains zero.

Independent-read checkpoints older than 30 minutes are discarded and reread before verification. Obsolete verification-read operation keys are removed from the billable set. Failed verification also clears its separate source cursor and run identity before bounded recovery.

Actual public source strategies are logged in `reliability_ledger` with outcome, method, failure category, latency, attempt, and work units. This dataset is a foundation. Adaptive strategy ranking, full provider telemetry aggregation, and an admin reliability dashboard are not implemented yet.

The existing heartbeat dispatches the jobs worker, and authenticated start/resume also launches server-side work through Next.js `after`. Cron returns acceptance promptly; the callback performs work after the response. Continued execution depends on a functioning heartbeat or worker deployment. Local fixtures do not prove production clock uptime.
