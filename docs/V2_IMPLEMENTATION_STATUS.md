# Kryx V2 implementation status

**Status: first verified Lead List vertical slice implemented and locally validated; V2 MVP acceptance is NOT complete.**

Baseline: `8ee2319`. Branch: `codex/kryx-v2-verified-jobs`. Production databases, subscriptions, deployments, and public guarantees were not changed. All rollout flags default off. Live acceptance is blocked because the actual Kryx staging/server configuration and authenticated test access are unavailable in this workspace. This does not mean the existing production credentials are absent. The connected healthy Supabase project still has no `agentstack` schema when rechecked on 10 October 2026, and was not modified.

## Implementation report (32 requested areas)

| # | Area | Implemented reality / status |
|---|---|---|
| 1 | Architecture before vs after | Legacy agent/template → prose → generation is preserved. V2 adds owned Job → contract → reserved budget → checkpointed stages → independent verifier → artifacts → atomic settlement/receipt. |
| 2 | Systems kept | Supabase/Google auth, profiles, wallet, Dodo/top-up history, routing, encrypted connectors, specialist templates, device PKCE/auth/signatures, local browser/device foundations, legacy history. Live behavior is not claimed revalidated. |
| 3 | Systems refactored | Hybrid mission storage, step dependencies, evidence ownership, heartbeat dispatch, founder home/navigation, safe profile repair, and wallet interaction with login. |
| 4 | UX hidden/deleted | Agent/squad/workflow/Room navigation and home roster are hidden under V2. Legacy pages remain readable. No stored user/agent/history data is deleted. |
| 5 | Database migrations | Eight additive V2 migrations plus missing `created_at` fix in 0031. Composite owner FKs, queue indexes, owner RLS, service-only RPCs, completion guard, progress persistence, cap changes, proof expiry gates, private lease-column grants, and safe repeated V2 application. |
| 6 | Job model | Persistent contract, estimate/cap/reservation, states, conversation, step graph, events, output digest, verdict, artifacts, usage, ledger, checkpoints and receipt. Existing hybrid storage reused. |
| 7 | Completion contracts | Lead List `1.1.0` defines count/ICP/outreach/source requirements and a 30-minute independent-read freshness limit before execution. Existing `1.0.0` records remain compatible. Missing referenced workspace ICP requires one clarification. Other classes intentionally rejected. |
| 8 | Verifier | Separate model call/run plus independent source reads; strict schemas, exact counts, normalized uniqueness, source/quote checks, semantic identity/fit/claim checks, CSV digest, fail-closed unknown predicates. |
| 9 | Recovery engine | Failure taxonomy, bounded attempts, delayed retries, candidate route rotation, Needs You for auth/CAPTCHA/2FA/config/cap. Failed verification rewinds extraction with source checkpoint retained. |
| 10 | Checkpoints | Durable stage and partial source batches/cursors, structured output, worker/verifier identities, contributing operation keys, lease token. Restart skips completed reads; successful peers of blocked sources are retained; stale tokens and expired verification reads are rejected. Paused passing proofs expire and trigger a new independent pass without redoing finished research. |
| 11 | Reliability Ledger | Actual HTTPS read outcome/method/failure/latency/attempt/work-unit records. Adaptive routing and operational aggregates remain pending. |
| 12 | Browser architecture | Existing local foundation retained. Current V2 source reader is HTTPS/API, not persistent Chromium. Cloud browser phase pending. |
| 13 | Watch | Not implemented; no attached browser, fake viewport, replay, or rendered Watch claim. Flag stays off. |
| 14 | Artifacts / evidence | Actual verified CSV and optional outreach Markdown; SHA-256 checked at transactional persistence and owned download. Paginated owned source metadata and on-demand recorded text expose research/independent checks, capture time, HTTP result and digest; text integrity is checked before delivery. |
| 15 | Approval intelligence | Current Lead List is read/draft only and cannot send/publish. Existing approvals retained. V2 exact-action cards/scoped policies/remote approvals remain pending. |
| 16 | Credits | Estimate range, editable pre-start cap, explicit paused-job cap increase reserving only the difference, immutable adjustment ledger, three active jobs/account, per-operation hard budget, free first successful verification, and real live budget/eligible cost. |
| 17 | Refund logic | Failed/cancelled reservations returned transactionally and idempotently. Settlement includes only successful contributing operation keys; failed/abandoned attempts excluded. These are wallet returns, not Dodo payment reversals. |
| 18 | Model routing | Existing provider candidates reused, bounded sequential failover, role-separated extraction/verifier requests, schema validation and token usage capture. Provider dollar costs unavailable remain unmeasured. |
| 19 | Background execution | Authenticated start/resume launch server-side work after the HTTP response. Heartbeat has a registered jobs worker. Durable leases/checkpoints survive process loss; production clock still requires validation. |
| 20 | UI | Six navigation entries, composer, multiple persisted job threads/lists, criteria/estimate/cap review, real budget/eligible cost, actionable blockers, cap recovery, pause during verification, progress/artifacts/checks/receipt. Polling preserves cap edits and action errors; changing threads cannot show obsolete receipts. Eight production-component browser fixture tests pass; real authenticated E2E and follow-up composer remain pending. |
| 21 | Landing | Existing page unchanged. New landing flag reserved/off; no unverifiable public promise or fake receipt added. |
| 22 | Pricing | Existing payment products/history untouched. First verified free job implemented in job accounting; $49 Founder recurring product/checkout/webhook migration not implemented. |
| 23 | Analytics | Durable real creation/planning/start/checkpoint/recovery/verification/completion/refund/control events. Full activation funnel, second-job events and north-star aggregates remain pending. |
| 24 | Security | Owner RLS/RPC restrictions, private execution columns and public-response allowlists, legacy control fences, shared owner FKs, lease fencing, fixed read-only worker tools, untrusted source separation, pinned public DNS/redirect/credential restrictions, bounded payloads, artifact integrity. Login no longer mints/reduces credits. |
| 25 | Tests | 59 targeted V2 tests + 8 existing feedback tests and 8 browser component checks pass locally (75 checks total). Typecheck and production build pass. Lint passes with 21 existing warnings; both introduced effect/ref warnings were fixed. CI includes actual PostgreSQL concurrent cap increases/cancellations; live account E2E remains blocked. |
| 26 | Acceptance Jobs | A: production pipeline passes fixtures with source rereads/drafts/CSV; no real 20-founder acceptance yet. B/C/D/E: not enabled or passed. Outreach bundled in Lead List does not count as standalone D coverage. |
| 27 | First-attempt success | Unmeasured. Zero real dogfood jobs executed in this environment. Fixture pass rate is not execution reliability. |
| 28 | Verification false positives | Unmeasured. Adversarial fixtures rejected expected defects; this is not a live <5% false-completion measurement. |
| 29 | Cost measurements | Local accounting verifies specific debits/releases and exclusions. Vendor COGS/job and retry/refund gross margin are unmeasured. No fake 61-credit example or margin claim. |
| 30 | Known limitations | One supported runtime class; no cloud browser/Watch; no standalone drafts/research/competitor/content execution; no adaptive routing; no V2 schedules/skills/correction learning/approval policy UI; no new public pricing/landing/demo; no live account/payment E2E. |
| 31 | Launch blockers | Actual Kryx staging credentials, live Lead List acceptance, complete browser/Watch and four-class coverage, production RLS/advisors and historical migration validation, 50 real jobs, calibrated verifier/economics, real billing rollout and public-beta QA. |
| 32 | Next 10 highest-value actions | Listed below in implementation/gate order. |

## Local validation evidence

- `npm run test:v2`: **59 passed, 0 failed**. Actual production pure pipeline/verifier modules are loaded, not copied implementations. PostgreSQL tests execute 0031 and all eight V2 migrations with minimal prerequisites in PGlite.
- Database tests cover RLS/cross-owner access, service-only mutation, creation idempotency, completion guard, lease takeover, pause fencing, free entitlement, cap enforcement, eligible settlement, internal failure exclusions, reservation returns, cancellation idempotency, independent verdict binding, artifact digests, stale result writes, private lease-column restrictions and owned source reads, expired proof rejection before storage/settlement/completion, proof-refresh step reset, and reapplying additive migrations without resetting balances/history.
- `npm run typecheck`: both apps pass strict TypeScript.
- `npm run lint`: passes, 0 errors, 21 existing warnings. The pre-existing unescaped apostrophe error and both introduced UI warnings were fixed without suppressing rules.
- `npm run build`: optimized Next.js production build passes, including new API/job routes and existing 1,808 generated pages.
- `git diff --check`: passes.
- CI runs the V2 verifier/pipeline/PostgreSQL/security/API boundary tests alongside the existing feedback and wallet checks. Evidence fixtures reject tampered text/digests, invalid cursors/URLs, anonymous/cross-owner reads, and legacy V2 mutation paths. The UI renders hostile page markup as inert text, pages recorded source metadata, and shows integrity failures without a success claim.
- Combined local run of existing founder-feedback tests and V2 tests: **67 passed, 0 failed**.
- `npm run test:v2:ui`: **8 passed, 0 failed**, using the actual production Job component/CSS with test-only Next navigation and API fixtures. Local QA used packaged Chromium 153 after the standard browser CDN download returned a truncated archive. The fixture harness does not simulate real authentication, billing, workers, or task-owned cloud sessions, and never ships inside the product.
- CI runs concurrent cap increases and cancellations in separate PostgreSQL 16 connections. These tests cannot replace actual Supabase contention and staging validation.
- `supabase/schema.sql` regenerated from repository migrations. The previous snapshot lacked newer checked-in legacy migrations as well; regeneration includes them. This does not establish that all historical migrations can be applied to an arbitrary production database.

No real browser restart test, live authenticated account test, cloud viewport test, real provider failover test, real payment lifecycle test, production migration/advisor check, or 50-job dogfood measurement was possible without the application credentials/runtime. These are blockers, not implied passes.

## Read-only deployed checks (10 October 2026)

The existing production `/api/health` endpoint returned `ready` on baseline commit `8ee2319`, with database `ok=true` and `migrated=true`. Required legacy environment names were present; no credential values were retrieved. The endpoint reported `clock.beating=false`. This validates only the existing legacy database health, not V2 migrations, authenticated accounts, verified execution, billing or browser acceptance. The stalled clock is an additional live background-execution check before rollout.

The PR preview health request redirected to Vercel `/login` and returned HTML; it did not reach the application health response. Authenticated preview access is therefore required for live staging validation.

The local runtime still has no actual Kryx server configuration, and the connected healthy Supabase project has no `agentstack` schema. Existing working production infrastructure must be connected through the correct staging/deployment access rather than recreated.

## Acceptance gates

| Gate | Result |
|---|---|
| One Kryx shell / multiple Job records | Implemented; authenticated UI E2E pending |
| Lead List contract / separate verifier | Implemented; adversarial and pipeline fixtures pass |
| Failed verification cannot complete | Local domain/SQL tests pass |
| Recovery/checkpoint/lease takeover | Local tests pass; live worker restart pending |
| Estimates/caps/reservations/refunds | Local SQL tests pass; real account/payment checks pending |
| Artifacts / completion receipts | Implemented; local digest/settlement checks pass |
| Background processing | Implemented; real deployed heartbeat/close-tab test pending |
| Five verified task classes | FAIL — only Lead List enabled |
| Persistent cloud browser / Watch | FAIL — not implemented |
| V2 approvals / Needs You policies | Partial — safe read/draft class and blockers; consequential action phase pending |
| Existing authentication / billing | Code preserved and wallet-repair bug fixed; live regression pending |
| No fake product states/demo counts | No test fixtures or hardcoded success receipts in product surfaces |
| 50 real jobs / reliability / false positives / economics | FAIL — unmeasured |
| V2 public guarantee / $49 pricing / landing/demo | Not published or claimed |

## Next 10 actions

1. Connect the **actual Kryx** staging Supabase project and configure existing server-only model/search/encryption credentials; validate account/schema identity before any DDL.
2. Apply reviewed additive migrations on staging, run SQL/RLS/advisors, and verify existing balances/history/Google login/payment records.
3. Execute the real 20-founder acceptance job and inspect every CSV row, source, draft, predicate, ledger entry and receipt.
4. Force provider/source/verification failures and process restart; prove checkpoint recovery, close-tab continuation, limits, pause/cancel and reservation return on real accounts.
5. Repair measured Lead List quality gaps before enabling another class; validate missing ICP, exclusions and real source authority.
6. Deploy isolated persistent Chromium sessions with task attachment, actual DOM/viewport events, restart recovery, Watch and takeover.
7. Add the remaining four versioned verified classes one at a time using real acceptance outputs and independent verifier fixtures.
8. Add exact-action approvals/scoped policies and normal scheduled job creation; preserve authenticated Telegram/device foundations.
9. Configure/feature-flag the real $49 Founder product, monthly credits/top-ups, actual receipt demo, disciplined landing and activation analytics after the accounting/reliability measurements support them.
10. Run the 50 real-job dogfood set, measure first-attempt success/false completion/retry economics, finish live browser/account/payment E2E, then make the public-beta decision.

Access to the actual Kryx staging/runtime credentials and an authenticated test account is the immediate external dependency. Subsequent implementation and launch gates are still open; this report must not be described as a completed V2 MVP.
