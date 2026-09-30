# KryxAI Desktop V1.2 — Phase 1 audit

Date: 2026-09-29

## Executive finding

Kryx is already a functioning marketing-agent product. Desktop V1.2 should be an additive execution layer, not a rewrite.

The live codebase is this repository. The separate KryxAI-named repositories visible to the connected GitHub account are empty or partial; this repository contains the current Kryx branding, dashboard, agents, missions, credits, Telegram, tools and PAYG product.

## Reuse — do not rebuild

### Identity and account
- Supabase Auth is the source of truth.
- Existing web login supports Google OAuth and email/password.
- Google OAuth lands at `/auth/callback` and exchanges an authorization code for the existing Supabase session.
- `agentstack.profiles.id` is the same UUID as `auth.users.id`.
- Desktop must resolve to this same user id. No desktop-only user table.

### Data and tenancy
- Product tables live in the dedicated `agentstack` schema.
- RLS is enabled throughout the product schema.
- Server-only operations use the service-role client.
- Existing customer secrets are AES-256-GCM encrypted and never returned to browsers.

### Marketing agents
- Current roster includes specialist templates for leads, outreach, content, research, SEO, analytics, landing/conversion and related marketing work.
- The head orchestrator already routes founder instructions to a specialist.
- `runAgentOnce` is the existing execution entry point.
- Do not replace these agents with a second desktop-specific roster.

### Missions / founder attention
- Current mission UI derives `needs_you`, `in_flight`, `queued` and `done` from generations, leads, scheduled tasks and live agent activity.
- `NeedsYou` already exists.
- Desktop work should feed the same outcome surfaces, then V1.2 can add durable task-graph state behind them.

### Approval
- Generated work is unapproved by default.
- Telegram can approve pending work.
- X posting currently happens only after approval and only when a real connector exists.
- Desktop must strengthen this into capability-aware, per-action approvals instead of inventing a parallel approval system.

### Scheduling / remote control
- `scheduled_tasks`, cron heartbeat and Telegram are real.
- Telegram linking uses a one-time code plus a webhook secret.
- Reuse this channel for authorized remote commands; do not add an unauthenticated remote-control endpoint.

### Credits
- Current product is PAYG with `credit_balance`, purchase/spend ledgers and a starter grant.
- Desktop should charge only model / paid tool work. Local UI actions, file reads, clicks and keystrokes are execution primitives, not artificial credit events.

### Model routing
- Existing routing already fails over across multiple OpenAI-compatible providers.
- Preserve it.
- V1.2 needs task-class routing and richer provider/model/latency/cost/error telemetry, not another provider abstraction.

### External research/tooling
- Firecrawl and Monid already exist.
- Monid discovery/inspect/run is cost-aware and returns upstream cost.
- Prefer these structured cloud tools when reliable; local browser execution is the fallback for logged-in tools or unsupported actions.

### Billing/deployment
- Dodo PAYG checkout/webhook exists.
- Web app deploys on Vercel.
- Existing per-agent Hermes deployments remain supported, but desktop missions should not require a new Vercel deployment per local step.

## Current gaps against Desktop V1.2

1. No registered-device model or revocable device credential.
2. No local runtime.
3. No authenticated cloud-to-device task channel.
4. No structured browser controller for the founder's already logged-in browser.
5. No native accessibility controller.
6. No file/terminal capability policy.
7. No durable mission-step/task graph with the requested execution states.
8. Existing head routing delegates mostly to one specialist, not a multi-agent DAG.
9. Existing approval is generation-centric, not capability/risk-centric.
10. No Observer / Shadow mode.
11. No workflow detection/versioning.
12. No desktop DMG/signing/update pipeline.
13. No desktop install-to-first-completed-job funnel.
14. Landing/download flow does not yet represent desktop.

## Desktop architecture decision

### Shell
Use Electron for V1.2, macOS first.

Reason:
- Browser Use Desktop is Electron and MIT, so release/update patterns can be reused legally.
- Electron gives mature macOS tray/menu-bar, notifications, deep links, Keychain bridges and code signing.
- It stays in the repository's TypeScript/Node toolchain and avoids creating a second Rust build system during the first desktop milestone.
- Performance is controlled by keeping automation in sidecars/events, not continuous rendering or screenshots.

Windows remains possible because the cloud protocol and runtime interfaces are platform-neutral.

### Browser execution
Order:
1. official API / existing Kryx structured tool
2. structured control of the user's local browser session
3. OS accessibility
4. vision fallback

For authenticated local browser work, do not export browser cookies to Kryx Cloud. Prefer a local browser bridge / extension or Browser Use system-browser attachment. Any session material remains local.

### Native computer execution
Use OpenSymph Open Computer Use as the primary reusable accessibility primitive, pinned to a reviewed commit. It is MIT licensed and explicitly local/accessibility-first.

### Device trust
- Desktop signs into the same Supabase account.
- A verified Supabase bearer session may register a device.
- Registration mints a separate opaque device credential.
- Only the token hash is stored server-side.
- Device credential is short-lived and revocable.
- Desktop stores auth/session material in macOS Keychain.
- Each device also registers a local public key for future signed result envelopes.
- Revoking a device revokes all device sessions.

### Cloud ↔ local boundary
Cloud owns: account, workspaces, planning, model/tool work, credits, mission graph, approvals, shared marketing memory.

Local owns: browser sessions, accessibility execution, local files, terminal, private credentials, local execution log buffer.

Passwords, cookies, credential stores, full browser history and private files are not uploaded by default.

## Open-source license review

Reviewed exact LICENSE files:
- `browser-use/browser-use` — MIT, copyright Gregor Zunic.
- `browser-use/desktop` — MIT, copyright Browser Use.
- `opensymph/open-computer-use` — MIT, copyright opensymph.
- `nogu66/open-computer-use` — MIT, copyright Yuta Noguchi.

Policy: pin exact revisions before copying source; preserve copyright/license text for any copied substantial portion; keep an attribution ledger in `docs/THIRD_PARTY_DESKTOP.md`.

## Supabase production safety finding

The connected Supabase account exposes three projects. The only active healthy project does not contain the `agentstack` schema and its migration history is clearly for another product. The two other projects are inactive and timed out during inspection.

Therefore no production database mutation is safe from this session. Desktop migrations are committed to the Kryx repository but must not be applied to the active unrelated project.

## Phase gate

Phase 1 is complete when this audit is committed.

Phase 2 starts with additive device/session tables and authenticated registration/session endpoints. No computer-control code should bypass that trust layer.
