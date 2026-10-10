# Kryx V2 read-only repository audit

Audited baseline: `8ee2319` (2026-10-08). No product code was changed during this audit.

## Findings that determine implementation

The web app is Next.js 16/React 19, with a separately bundled Hermes runtime. Supabase uses the `agentstack` schema. Workspaces currently exist as founder/head-agent configuration and `workspace_key` on hybrid missions, not a workspace membership domain. Do not pretend a multi-user workspace model already exists.

`head-orchestrator.ts` chooses a named agent with keyword routing and `runAgentOnce` returns success for usable prose. Hybrid missions persist a sequential dependency graph, device tasks, approvals, and evidence. Their cloud advancement marks a step completed from text; after all steps finish, the mission is completed without a separate evidence verifier. This is the principal correctness gap.

There is a real local browser extension/accessibility executor. There is no persistent cloud Chromium service or live browser stream in this checkout. Firecrawl is a public search/scrape API, not a live browser. These must not be described as interchangeable.

The existing wallet has atomic credit debits and idempotent Dodo top-ups. Some tool paths charge per attempt. Reusing those metered paths for verified jobs would violate the new promise. V2 needs reserved budgets and settlement after independent verification, with separate internal usage records.

## Subsystem implementation map

| Subsystem | Decision | Evidence / change boundary |
|---|---|---|
| Supabase session / Google login | KEEP | `lib/auth.ts`, `auth/callback`, SSR clients; preserve repair and return paths |
| Profiles and users | KEEP | Existing grants and wallet; no reset/backfill of balances |
| Founder workspace context | REFACTOR | Head-agent `config`, profile onboarding, `team_wiki`; scoped retrieval adapter |
| Specialist templates | KEEP / HIDE_FROM_USER | Hermes templates and shared primitives remain internal |
| Agent selection / squad configuration | HIDE_FROM_USER | Sidebar, command center, roster; preserve legacy deep links/history |
| Mission board | MERGE | Read legacy history, promote `hybrid_missions` to persistent Job storage |
| Hybrid mission steps | REFACTOR | Reuse step DAG and device FKs; add contracts, leases, checkpoints |
| Device tasks | KEEP | Signed envelopes, nonce, expiry, revocation and platform capability checks |
| Per-agent chat / Room | HIDE_FROM_USER | Keep readable records; new JobMessage threads own V2 conversations |
| Wallet credits | REFACTOR | Atomic reservations, verified settlement, refunds/release, idempotency |
| Dodo / payment history | KEEP | Existing signed webhook, top-ups and plan history |
| Provider routing | KEEP / REFACTOR | `agent-model-routing.ts`; separate extraction/writing/verifier invocations |
| Search / public data tools | KEEP | Firecrawl / Apollo / Monid primitives; avoid legacy attempt billing |
| Cloud browser | REBUILD | Dedicated isolated persistent Chromium runtime, task attachment and watch |
| Desktop browser / macOS runtime | KEEP | Electron bridge, permission engine, signed device tasks |
| Android runtime | KEEP | Java accessibility/TaskRunner, auth and device registration |
| Approval storage | KEEP / REFACTOR | `action_approvals` reused; exact previews, expiry, owner checks, risk levels |
| Evidence | REFACTOR | `task_evidence` reused; source snapshots/digests and verifier provenance |
| Completion | REBUILD | Versioned contracts, independent pass, fail closed, atomic verified finalization |
| Scheduler / heartbeat | KEEP / REFACTOR | Add V2 job queue worker; legacy schedules remain valid |
| Memory / learning | REFACTOR | `team_wiki`, agent notes/playbook retained; relevant scoped retrieval |
| Telegram | KEEP | Linked chat authentication and webhook secret; preserve status/approval channel |
| Admin / analytics | REFACTOR | Restricted operational views and real Job events; no private-content default |
| Landing / pricing | REBUILD behind flag | One promise/composer; no invented receipts or guarantee before measurements |
| Download / device PKCE | KEEP | Existing OS downloads/auth/revocation; secondary executor |

## Phase order and validation

1. One Kryx shell and six navigation entries (flagged); old routes/history remain readable.
2. Extend hybrid missions/steps, reuse evidence/approvals, add missing job records only.
3. Lead List contract with adversarial verifier tests, then independent execution/verification.
4. Lease fencing, bounded failures and safe checkpoints; crash/retry integration tests.
5. Transactional budget reservations, settlement/refunds; concurrent/idempotency SQL tests.
6. Isolated persistent browser runtime; real viewport watch and recovery tests.
7. Four remaining classes only after the Lead List pipeline passes meaningful checks.
8. Approvals, scheduled normal jobs, honest landing/pricing, dogfood and launch measurements.

## Environment findings

No application secrets or existing checkout were supplied in this execution environment. Repository access works. Connected Supabase projects do not identify this application's `agentstack` schema: the healthy project inspected contains SaaSGrave tables instead. It must not be mutated for Kryx. Live acceptance and production migration require the actual Kryx database/model/search/browser configuration. Local validation and reviewable implementation can proceed independently.

## Launch evidence rules

Fixture tests are not real dogfood jobs. No completion-rate, false-positive, margin, or live browser claim may be inferred from a passing unit suite. The 50 real jobs and specified reliability thresholds remain explicit gates until measured.
