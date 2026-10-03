# Verification evidence

Tested code commit: `3362d69021ac35c866f491a9df3a9643caa1ec98`.

[Operator CI run](https://github.com/tharolankit19-create/agentstack/actions/runs/37105669681) completed successfully on 2026-10-03. The repository CI run also passed. No production release, merge, customer email or target database migration was performed.

| Check | Result | Scope |
| --- | --- | --- |
| npm run typecheck | Pass | Hermes core and Next.js |
| npm test | 43 pass, zero failures | 39 operator/PGlite/provider tests and 4 runtime policy tests |
| npm run test:playwright | 3 pass | Real components, controlled providers, persistent SQL-backed harness |
| npm run build | Pass | Production Next.js application |
| Public adapter API smoke | Pass | Actual GitHub repository JSON through pinned public HTTPS transport, no credentials |
| PostgreSQL concurrency | 6 gates pass | Twelve claim sessions; capacity, unique leases, atomic wallet reservations, competing spend, ten one-time approval consumers, stale/paused fencing and RLS |
| Built landing smoke | Pass | Built Next.js desktop/mobile rendering and viewport checks |
| Docker image/Compose | Pass | Real runtime build and broker/proxy startup |
| Runtime public capture | Pass | Sandboxed Chromium, real permitted page PNG/text and metadata denial |
| Tenant isolation and restart | Pass | Separate volumes, resource controls, internal network, denied cross-tenant read/traversal, disabled terminal, file/profile persistence after runtime restart |
| Live founder acceptance 1–5 | Pending | Confirmed Kryx database, deployed scheduler/runtime, providers and remaining feature gates required |

The PostgreSQL test uses a dedicated throwaway database and independent psql processes. It never connects to customer state and performs no external send. Product browser tests use visibly labelled provider fixtures; they establish task persistence, review, installation and artifact mechanics, not live founder research.

The new adapter flow verifies discovery plan → durable proposal → credential-free sandbox → explicit installation → reviewed API read → source artifact. Installation rejects altered/untested definitions; vault access is service-only; production provider tests verify owner scope, auth headers, policy denial and redaction of echoed keys.

Heartbeat regression verifies that HTTP errors/timeouts never become successful acknowledgements. Diagnosis separately reports configuration, runtime readiness and recent persisted scheduler dispatch.

## Screenshots and source recovery

Download **kryx-product-evidence** from the run's Artifacts section. Artifact ID: `11267428697`. ZIP sha256:6d1cbf0511d5c2d5fe3a29379181c638a1082927ec829a947f22e6c0b3ea6abc. Retention expires 2027-01-01T07:14:06Z.

The ZIP contains plan, artifacts-and-approvals, mobile-home, adapter-review, adapter-artifact, integrations-mobile, landing-desktop, landing-hero and landing-mobile PNGs. Six product captures use labelled QA fixtures; the three landing captures use the built Next.js page without invented metrics.

Every operator verification now also stores **kryx-source-checkpoint**: the exact git source archive, commit ID and SHA-256 checksum. The checkpoint is retained for 30 days and permits verified source recovery when an execution workspace is lost.

## Release status

The complete requested transformation remains unfinished. See [REPORT.md](REPORT.md), [ADAPTERS.md](ADAPTERS.md), [FILES.md](FILES.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

No Kryx database/runtime credentials were present in the execution environment. The connected active Supabase project previously inspected had no AgentStack schema; the other projects are inactive. No unrelated project was modified. Supabase CLI security advisors could not connect to a local PostgreSQL service (no Docker/Postgres host here); owner/RLS/RPC checks passed in PGlite and real PostgreSQL CI. Run target-project advisors during confirmed staging deployment.

A documentation-only follow-up may reference this immutable verified code revision. New source changes require renewed verification.
