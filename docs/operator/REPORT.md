# Kryx persistent operator implementation report

**Release status: draft implementation; full production transformation is not complete.**

All product changes are in AgentStack on `codex/kryx-persistent-operator`, [PR #60](https://github.com/tharolankit19-create/agentstack/pull/60). No merge, production migration, customer email or release was performed. This report distinguishes implemented execution from future architecture and controlled acceptance fixtures.

## Architecture before and after

| Area | Existing AgentStack | This branch |
| --- | --- | --- |
| Primary object | Configured agent and conversation | Owned goal, reviewed plan, persistent DAG tasks |
| Execution | Narrow agent loop, heartbeat and scheduled work | Additive leased queue with fenced checkpoints; existing workers retained |
| Delegation | Individually selected workers | Kryx selects supported research, qualification, draft, audit, monitor and report operations |
| Output | Responses and drafts | Versioned artifacts, sources, tool runs, task events and approvals |
| Memory | Existing agent remember behavior | Separate typed, confirmed workspace memory; legacy memory retained |
| Browser | Existing tools | Isolated Chromium runtime API with persistent workspace volume |
| Billing | Dodo PAYG mapping and credit truth | Same products/prices; atomic goal budgets and credit ledger reservations |

The existing Hermes infrastructure, encrypted connector vault, Supabase auth/RLS, Dodo billing, generic legacy tools, worker deployment isolation and heartbeat remain in place. The new operator is additive. Legacy agents remain reachable from the dashboard rather than being converted destructively.

## Durable task architecture

`contracts.ts` validates plans, dependencies, cycles, structured model results and evidence. `engine.ts` passes objective, constraints, dependency outputs, business context and typed memory as a structured handoff. It supports independent ready tasks in parallel, with two active workers per user.

Postgres functions claim tasks with `FOR UPDATE SKIP LOCKED`, serialize account capacity, issue lease tokens, heartbeat leases, fence stale workers, checkpoint completion and store artifacts together. Attempts have timeouts, retry counts, exponential backoff, errors and run records. Failed or abandoned work remains visible; it can be resumed. Pause/cancel invalidate leases. Editing a READY plan retains cancelled historical tasks and creates a revision.

Goal creation and routine firings have idempotency keys. Tool reservations cache successful results and reserve credits atomically. Invalid structured model responses fail before they can be cached as successful output. Irreversible actions use a separate one-time broker.

The Next.js API persists the goal before acknowledging it, then dispatches bounded work with `after()`. A persisted `cron_ticks` registration allows the existing heartbeat to continue work when the browser closes or an invocation dies. The cron endpoint acknowledges with HTTP 202 before background work, because the existing heartbeat has a 15-second dispatch timeout. Actual schedule precision depends on the deployed heartbeat cadence; the source registry's one-minute interval does not change a host's five-minute cron.

## Migration

`supabase/migrations/20261002112256_kryx_operator.sql` was created with the Supabase CLI. It adds 17 `agentstack.kryx_*` tables:

goals, tasks, task_dependencies, task_runs, task_steps, task_events, artifacts, approvals, approval_rules, memories, skills, routines, computer_sessions, tool_runs, trigger_events, notifications and email_suppressions.

There are no dropped existing tables. Ownership uses composite foreign keys and RLS. Authenticated clients can read their own records; mutations go through authenticated server routes and service-role functions. RPC execution is revoked from public/anon/authenticated. Server routes pin mutations to the signed-in user. Lease tokens are omitted from browser task responses.

## Computer runtime

`apps/computer-runtime` contains the runtime, trusted Docker broker, restricted CONNECT proxy and deployment Compose file. A workspace maps to a hashed container and named volume. The profile, screenshots and files persist under `/workspace`; expired containers can be removed while the volume remains.

Runtime containers use non-root Chromium, browser sandboxing, a seccomp profile, dropped capabilities, no-new-privileges, a read-only root, bounded temporary storage, CPU/memory/PID limits and an internal network. The broker alone holds the Docker socket. Strong server bearer tokens authenticate infrastructure calls; browser/model clients do not receive them. Docker child-process errors are sanitized because their argument lists contain runtime credentials.

Only allowlisted public HTTPS destinations are permitted. The internal browser validates HTTPS, exact domains and private literal IPs without requiring external DNS. The dual-network egress proxy checks all DNS results for private/metadata/reserved addresses and pins the resolved public IP. Chromium captures desktop/mobile PNGs and text. File reads are scoped to the workspace files directory with symlink checks. Terminal execution is disabled by default and lacks a product action executor, so it must remain disabled in a release. Downloads are disabled until a bounded quarantine/scanner pipeline is installed.

The vendored Playwright seccomp profile and full Apache 2.0 license are attributed in the runtime notices. Open Dots informed the design; its Python source was not copied into the TypeScript product.

## Approval architecture

Registered actions have READ, SAFE_WRITE, EXTERNAL_COMMUNICATION, PUBLIC_PUBLISH, FINANCIAL, DESTRUCTIVE or SECURITY risk. Unknown and inherited object keys are denied. READ/draft actions are allowed by default; external sending, public publishing, financial, destructive and production changes ask by default. Persisted ALLOW/ASK/DENY rules override defaults. Providers check rules; artifact creation also checks its rule.

Email is the implemented consequential executor. Preview records bind the exact sender, recipient, subject and text to a canonical SHA-256 fingerprint. Owner approval is expiring and consumed once before dispatch. A changed payload cannot execute. The provider receives an idempotency key derived from the approval ID. Provider acknowledgement atomically updates the approval, tool run, step and audit event. Ambiguous post-dispatch failures become UNKNOWN and are not automatically resent.

Email requires an owned Resend key and verified delivery webhook configuration. Signed webhook events are owner/provider-ID bound and deduplicated; bounces/complaints suppress recipients. Production outreach still needs consent/opt-out/address handling and a full sending review. No email was sent during verification.

## Memory, skills and routines

Typed memory supports PROFILE, BUSINESS, AUDIENCE, STYLE, PROJECT, PROCEDURAL, EPISODIC, COMPETITOR and FACT. Unique scope/type/key upserts confirm existing observations instead of creating duplicate rows. Confirmation counts, confidence, sources and verification timestamps are stored. Changed values reset confidence. Prompts explicitly treat memory as context and source pages as untrusted evidence.

Completed workflows can be saved as TESTED Skills with version, plan, tools, approval rules, validation and source goal. Tested skills can create another reviewed goal. Untested Teach Kryx recordings and generated adapters cannot enable production secret access. Those contracts are future-ready architecture, not a delivered recorder or tool-generation UI.

Routines store schedule, timezone, next/last run, policy and enabled state. Leased due routines create idempotent goals without an open tab. Timezone/DST calculation is tested. Competitor monitoring stores a baseline with completion, compares source text, queues evidence-backed material-change alerts and stays quiet when unchanged. Telegram notifications use the existing connected-account path. Uncertain notification delivery is retained as UNKNOWN. The signed trigger bridge is extensible; vendor-specific signature verification must happen before the bridge.

## Integrations, routing and costs

The operator uses the existing encrypted connector registry. Real model-provider routing remains available with role overrides and bounded alternatives. User-owned model/search credentials are preferred where supported. Search/read use Firecrawl and Monid where available; capture uses the Kryx runtime. The generic router expresses native connector → API → MCP → browser preference, but all requested native OAuth integrations are not implemented in this branch.

Model token usage, provider duration and tool credits are recorded. Numeric token counts survive secret redaction. Goal budget and account wallet are checked before tool use. Browser captures cost two existing credits; BYOK model calls avoid platform model credits where supported. Runtime-minute accounting and role-specific capacity enforcement remain unfinished.

## Product, landing, pricing and onboarding

Home asks “What should Kryx get done?” and creates a plan instead of a chat reply. Tasks support review/edit/start, activity, artifacts, computer captures, memory, pause/cancel/resume and exact email decisions. Navigation now centers Home, Tasks, Routines, Skills, Memory, Artifacts, Integrations, Activity, Computer and Settings. Activity renders actual stored events and UI polls them; there are no fabricated thinking indicators.

The landing page uses Kryx's own typography and calm neutral visual identity. It sells goals, plans, background execution, evidence, computer, approvals, memory, routines and founder use cases. Its product block uses the actual component. Anonymous visitors see empty state, not invented progress or fake success counters.

Pricing is data-backed and preserves inspected Dodo/PAYG compatibility: existing prices/product IDs and signup/minimum top-up rules remain. Future capacity packaging is represented as configuration, not new hardcoded live prices. Onboarding collects business, website and goal, stores typed business context, points to integrations and starts the first goal. Users do not configure a catalog of specialist agents.

## Verification and screenshots

The authoritative latest result is [the PR checks](https://github.com/tharolankit19-create/agentstack/pull/60/checks), tied to the tested commit. CI runs typecheck, unit/integration tests, Playwright, production build, built Next.js landing capture, Docker image build, isolated runtime smoke and actual two-tenant isolation/restart verification. Screenshots are uploaded in the `kryx-product-evidence` Actions artifact.

The browser product harness uses real product components, a real SQL-backed PGlite store and explicit controlled provider fixtures. Fixture screenshots are labelled as QA data. They prove persistence/approval UI mechanics, not real lead discovery or live email delivery. Built Next.js landing screenshots use the production build without seeded metrics.

| Acceptance gate | Automated evidence | Live gate |
| --- | --- | --- |
| 1: leads, drafts, stop for approval | Controlled source-backed fixtures, qualification/dedupe and exact approval tests | Real sources/provider keys, sender/webhook and approved test recipient required |
| 2: routine monitor and quiet unchanged runs | Due-routine leasing, timezone/DST, baseline/material-change/outbox tests | Deployed scheduler and connected notification channel required |
| 3: page audit | Controlled audit artifacts plus separate isolated browser smoke | Actual founder page/mobile/analytics and approved edit/deploy path required; visual analysis/editing incomplete |
| 4: close tab/restart | SQL-backed close/reopen browser flow and disk-backed PGlite restart/lease tests | Real deployed app and worker restart test required |
| 5: provider failure | Recorded failures, retries, visible final failure and bounded fallback | Live configured-provider outage/fallback exercise required |

**Verified code commit:** `88091dc2842d04643784463c820480bbe3a99297`. Both CI workflows completed successfully. Typecheck, 32 operator tests, four runtime policy tests, two Playwright product flows, production build, built Next.js desktop/mobile captures, Docker build, real sandboxed capture/metadata denial and two-tenant isolation/restart checks passed. Vercel's preview status also reported success. [Immutable verification run](https://github.com/tharolankit19-create/agentstack/actions/runs/37011423959) contains the screenshot artifact. These results do not replace the live acceptance and remaining feature gates below.

## Remaining limitations and release gates

The complete requested transformation is not delivered yet. Work still required includes:

- Native OAuth adapters and all specialist capabilities; executing the full existing generic tool registry through the new governed operator.
- Full browser interaction, authenticated takeover/live viewing, per-workspace domain-policy UI, vision analysis and approved code-edit/deployment execution.
- Teach Kryx recording/test/review/save UX and complete generated-adapter discovery/sandbox/install/execution UX.
- Attachment uploads, richer onboarding inference, artifact object storage/pagination, memory reconciliation with legacy remember(), skill success/failure accounting and capacity-tier enforcement.
- Safe bounded downloads/scanning, volume quotas, orphan reconciliation after broker restart, session lifecycle hardening and tenant isolation/load testing on the target runtime host.
- Complete outreach consent/opt-out/address handling, unsubscribe UX and real deliverability/suppression integration tests.
- Real authenticated Next.js API/product E2E and concurrent Postgres/load testing, rather than relying solely on PGlite/controlled providers.
- Production database migration, deployed computer connectivity and all five live acceptance exercises.

The execution workspace disconnected during the final local verification, so unavailable local changes/screenshots were not asserted as preserved. Critical changes were reconstructed from the saved repository checkpoint and verified through remote CI. The connected active Supabase project inspected had no AgentStack schema; it was not modified. No confirmed Kryx database/production runtime access was available.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the concrete deployment and live verification procedure and [FILES.md](FILES.md) for the exact changed-file inventory.
