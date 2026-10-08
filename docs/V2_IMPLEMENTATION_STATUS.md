# Kryx V2 implementation status

**Status: first verified Lead List vertical slice implemented and locally validated; V2 MVP acceptance is NOT complete.**

Baseline: `8ee2319`. Branch: `codex/kryx-v2-verified-jobs`. Production databases, subscriptions, deployments, and public guarantees were not changed. All rollout flags default off. Live acceptance is blocked by the absent Kryx Supabase/server/provider configuration. The connected healthy Supabase project inspected contains SaaSGrave, not the Kryx schema, and was not modified.

## Implementation report (32 requested areas)

| # | Area | Implemented reality / status |
|---|---|---|
| 1 | Architecture before vs after | Legacy agent/template → prose → generation is preserved. V2 adds owned Job → contract → reserved budget → checkpointed stages → independent verifier → artifacts → atomic settlement/receipt. |
| 2 | Systems kept | Supabase/Google auth, profiles, wallet, Dodo/top-up history, routing, encrypted connectors, specialist templates, device PKCE/auth/signatures, local browser/device foundations, legacy history. Live behavior is not claimed revalidated. |
| 3 | Systems refactored | Hybrid mission storage, step dependencies, evidence ownership, heartbeat dispatch, founder home/navigation, safe profile repair, and wallet interaction with login. |
| 4 | UX hidden/deleted | Agent/squad/workflow/Room navigation and home roster are hidden under V2. Legacy pages remain readable. No stored user/agent/history data is deleted. |
| 5 | Database migrations | Four additive V2 migrations plus missing `created_at` fix in 0031. Composite owner FKs, queue indexes, owner RLS, service-only RPCs, completion guard, and safe repeated V2 application. |
| 6 | Job model | Persistent contract, estimate/cap/reservation, states, conversation, step graph, events, output digest, verdict, artifacts, usage, ledger, checkpoints and receipt. Existing hybrid storage reused. |
| 7 | Completion contracts | Versioned Lead List contract before execution. Count/ICP/outreach/source requirements inferred; missing referenced workspace ICP requires one clarification. Other classes intentionally rejected. |
| 8 | Verifier | Separate model call/run plus independent source reads; strict schemas, exact counts, normalized uniqueness, source/quote checks, semantic identity/fit/claim checks, CSV digest, fail-closed unknown predicates. |
| 9 | Recovery engine | Failure taxonomy, bounded attempts, delayed retries, candidate route rotation, Needs You for auth/CAPTCHA/2FA/config/cap. Failed verification rewinds extraction with source checkpoint retained. |
| 10 | Checkpoints | Durable stage, sources, structured output, worker/verifier identities, contributing operation keys, lease token. Restart resumes latest checkpoint; stale token rejected. |
| 11 | Reliability Ledger | Actual HTTPS read outcome/method/failure/latency/attempt/work-unit records. Adaptive routing and operational aggregates remain pending. |
| 12 | Browser architecture | Existing local foundation retained. Current V2 source reader is HTTPS/API, not persistent Chromium. Cloud browser phase pending. |
| 13 | Watch | Not implemented; no attached browser, fake viewport, replay, or rendered Watch claim. Flag stays off. |
| 14 | Artifacts | Actual verified CSV and optional outreach Markdown; SHA-256 checked at transactional persistence and owned download; attachment/nosniff headers. |
| 15 | Approval intelligence | Current Lead List is read/draft only and cannot send/publish. Existing approvals retained. V2 exact-action cards/scoped policies/remote approvals remain pending. |
| 16 | Credits | Contract estimate range, editable pre-start cap, atomic reservation, three active jobs/account, internal per-operation hard budget, first successful verified completion free. |
| 17 | Refund logic | Failed/cancelled reservations returned transactionally and idempotently. Settlement includes only successful contributing operation keys; failed/abandoned attempts excluded. These are wallet returns, not Dodo payment reversals. |
| 18 | Model routing | Existing provider candidates reused, bounded sequential failover, role-separated extraction/verifier requests, schema validation and token usage capture. Provider dollar costs unavailable remain unmeasured. |
| 19 | Background execution | Authenticated start/resume launch server-side work after the HTTP response. Heartbeat has a registered jobs worker. Durable leases/checkpoints survive process loss; production clock still requires validation. |
| 20 | UI | Six navigation entries, composer, multiple persisted job threads/lists, criteria/estimate/cap review, pause/resume/cancel, progress, real artifacts/checks/receipt. Full authenticated browser E2E and follow-up composer remain pending. |
| 21 | Landing | Existing page unchanged. New landing flag reserved/off; no unverifiable public promise or fake receipt added. |
| 22 | Pricing | Existing payment products/history untouched. First verified free job implemented in job accounting; $49 Founder recurring product/checkout/webhook migration not implemented. |
| 23 | Analytics | Durable real creation/planning/start/checkpoint/recovery/verification/completion/refund/control events. Full activation funnel, second-job events and north-star aggregates remain pending. |
| 24 | Security | Owner RLS/RPC restrictions, shared owner FKs, lease fencing, fixed read-only worker tools, untrusted source separation, pinned public DNS/redirect/credential restrictions, bounded payloads, artifact integrity. Login no longer mints/reduces credits. |
| 25 | Tests | 30 targeted verifier/pipeline/database/public-web tests pass. Typecheck and production build pass. Lint passes with 22 warnings (existing warnings plus browser-storage effect warning); no rules/tests disabled. |
| 26 | Acceptance Jobs | A: production pipeline passes fixtures with source rereads/drafts/CSV; no real 20-founder acceptance yet. B/C/D/E: not enabled or passed. Outreach bundled in Lead List does not count as standalone D coverage. |
| 27 | First-attempt success | Unmeasured. Zero real dogfood jobs executed in this environment. Fixture pass rate is not execution reliability. |
| 28 | Verification false positives | Unmeasured. Adversarial fixtures rejected expected defects; this is not a live <5% false-completion measurement. |
| 29 | Cost measurements | Local accounting verifies specific debits/releases and exclusions. Vendor COGS/job and retry/refund gross margin are unmeasured. No fake 61-credit example or margin claim. |
| 30 | Known limitations | One supported runtime class; no cloud browser/Watch; no standalone drafts/research/competitor/content execution; no adaptive routing; no V2 schedules/skills/correction learning/approval policy UI; no new public pricing/landing/demo; no live account/payment E2E. |
| 31 | Launch blockers | Actual Kryx staging credentials, live Lead List acceptance, complete browser/Watch and four-class coverage, production RLS/advisors and historical migration validation, 50 real jobs, calibrated verifier/economics, real billing rollout and public-beta QA. |
| 32 | Next 10 highest-value actions | Listed below in implementation/gate order. |

## Local validation evidence

- `npm run test:v2`: **30 passed, 0 failed**. Actual production pure pipeline/verifier modules are loaded, not copied implementations. PostgreSQL tests execute 0031 and all four V2 migrations with minimal prerequisites in PGlite.
- Database tests cover RLS/cross-owner access, service-only mutation, creation idempotency, completion guard, lease takeover, pause fencing, free entitlement, cap enforcement, eligible settlement, internal failure exclusions, reservation returns, cancellation idempotency, independent verdict binding, artifact digests, stale result writes, and reapplying additive migrations without resetting balances/history.
- `npm run typecheck`: both apps pass strict TypeScript.
- `npm run lint`: passes, 0 errors, 22 warnings. The pre-existing unescaped apostrophe error was fixed without suppressing rules.
- `npm run build`: optimized Next.js production build passes, including new API/job routes and existing 1,808 generated pages.
- `git diff --check`: passes.
- `supabase/schema.sql` regenerated from repository migrations. The previous snapshot lacked newer checked-in legacy migrations as well; regeneration includes them. This does not establish that all historical migrations can be applied to an arbitrary production database.

No real browser restart test, live authenticated account test, cloud viewport test, real provider failover test, real payment lifecycle test, production migration/advisor check, or 50-job dogfood measurement was possible without the application credentials/runtime. These are blockers, not implied passes.

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

The missing connection/credentials are the immediate external dependency. Subsequent implementation and launch gates are still open; this report must not be described as a completed V2 MVP.
