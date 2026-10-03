# Kryx operator deployment and live acceptance

This branch is a draft. Do not advertise the complete mission as delivered until the feature gaps in REPORT.md and live gates below are closed.

## Required environment

Use the existing Kryx project and preserve its production configuration. Store credentials in the hosting secret manager or connector vault; do not paste secrets into chat, client environment variables or artifacts.

- Confirm the correct Supabase project with the existing `agentstack` schema, profiles, credit ledger and `cron_ticks`.
- Preserve `SECRETS_ENCRYPTION_KEY`. Rotating it without re-encryption breaks existing connector secrets.
- Preserve auth callbacks, Dodo product/webhook mapping and existing RLS.
- Keep existing supported model-provider environment. Optional overrides are `KRYX_MODEL_PLANNER`, `KRYX_MODEL_CLASSIFY`, `KRYX_MODEL_RESEARCH`, `KRYX_MODEL_CODING`.
- Set `KRYX_COMPUTER_API_URL` to an HTTPS reverse proxy for the trusted broker and `KRYX_COMPUTER_API_KEY` to a strong server-only key of at least 32 characters.
- Set `KRYX_TRIGGER_BRIDGE_SECRET` only when using a vendor-verified webhook bridge.
- Configure the existing cron secret mechanism and stable `NEXT_PUBLIC_APP_URL`.

## Database staging first

Check out `codex/kryx-persistent-operator`. Install with `npm ci`. Run `npm run typecheck`, `npm test`, `npm run test:playwright` and `npm run build`.

Link the Supabase CLI to the **confirmed** Kryx staging project. Inspect the pending migration list/diff and apply the additive migration with the normal Supabase migration workflow. Do not apply to a project just because it is the only connected active project.

Verify:

1. Existing users, agents, wallet balances, billing events and encrypted connectors remain intact.
2. All 19 new tables have RLS enabled and cross-account reads are denied. The adapter credential table is service-only.
3. Authenticated clients cannot invoke service-only mutation RPCs.
4. `select worker from agentstack.cron_ticks where worker='operator';` returns one row.
5. A persisted test goal survives app restart and old worker leases cannot finish it.
6. The heartbeat actually fires at the expected deployed cadence; inspect operator task events and cron timestamps.
7. Apply both 20261002112256_kryx_operator.sql and 20261003064003_kryx_tool_adapters.sql in order. Run Supabase security/performance advisors on the confirmed staging database.
8. Exercise the [read adapter workflow](ADAPTERS.md). Verify an untested install is denied, a failed sandbox remains uninstalled, the exact passing definition can be installed, a task produces API evidence, and disabling deletes the credential.

Deploy the matching application version after the staging migration succeeds. Deployment is not a substitute for the live acceptance checks.

## Isolated computer host

Use a dedicated Linux Docker host controlled by the service. The broker has Docker administration access and must never be exposed directly to tenant browsers or models.

Build the runtime image:

```sh
docker build -t kryx-computer:local apps/computer-runtime
```

Configure `KRYX_COMPUTER_API_KEY` and `KRYX_ALLOWED_DOMAINS` as a JSON array of exact permitted hostnames in the host secret/config system. Do not use a wildcard allowlist. Start the broker and egress proxy:

```sh
docker compose -f apps/computer-runtime/compose.yaml up --build -d
```

The broker binds host loopback port 8090. Put an authenticated HTTPS reverse proxy in front of it for application access. Keep the Docker socket only in the broker. Keep terminal execution and downloads disabled.

The host must permit Chromium's non-root sandbox/user namespace operations under the supplied seccomp policy. Verify the intended host's AppArmor/kernel policy rather than switching off the browser sandbox. Enforce persistent-volume quotas and implement orphan session cleanup before a multi-tenant production release.

Run the real broker smoke with host/application environment configured:

```sh
node apps/computer-runtime/smoke.mjs
```

The smoke visits the configured permitted public URL, validates a real PNG/text capture and checks that metadata access fails. The CI-only `isolation-smoke.mjs` additionally checks two tenants, named-volume separation, resource controls, file traversal denial, disabled terminal and runtime-restart persistence. It requires `KRYX_ISOLATION_TEST_HOST=1`; never run it against a shared production host. Repeat with two workspace identities, verify distinct profiles/volumes/files, restart the broker, and verify persistence and expiry. Validate resource limits and no direct tenant egress.

## Connect real providers

Connect an owned model key and Firecrawl/Monid through the existing encrypted integrations screen. Use a real product website and explicit ICP. Missing sources must produce an actionable error or fewer leads, never an invented count.

For sending, connect an owned Resend key and a signing secret under `resend_webhook`. Configure provider events to `/api/kryx/email-events/<owner-user-id>` and verify signatures, duplicate events and suppression. Use a verified sender and a recipient explicitly designated for testing. Finish consent, unsubscribe and sender-address requirements before enabling outreach to prospects.

For notifications, link the intended owner account through the existing Telegram setup path. Verify unchanged monitor runs queue no notification.

## Five live acceptance exercises

Record goal IDs, event timestamps, provider IDs, sources, screenshots, artifacts, credit reservations and observed errors in a release evidence report.

1. **Leads and outreach:** enter the requested 20-founder goal with real website/ICP, source providers and verified sender. Review the plan. Verify discovered founders/product URLs/launch dates against live sources; inspect dedupe/scoring and CSV. Verify personalized drafts. Confirm no send call occurs before exact approval. Approve one designated test message; confirm one provider acknowledgement/audit event. Do not assert a promised count when evidence supports fewer leads.
2. **Competitor routine:** schedule a test routine in the owner timezone. Close the app. Verify the baseline run and one unchanged run are silent. Use an owned test page with a material pricing change; verify one source-backed alert and the saved baseline. Repeat unchanged and confirm no second alert.
3. **Landing conversion audit:** audit a real owned page with desktop/mobile screenshot evidence and real content. Connect funnel analytics when its adapter is available. Verify the report references actual findings. Full visual analysis/code editing/deployment remains a feature gate; approving a recommendation must not be represented as an applied production change.
4. **Resume:** start a long goal, close the browser, restart the app/worker host, reopen and compare durable completed steps/artifacts/approval records. Verify stale leases are fenced and irreversible actions are not repeated.
5. **Failure:** deliberately fail a configured provider in staging. Inspect tool failure and task trace. Verify a configured safe alternative or an actionable visible failed/paused goal. Restore the provider and resume. Confirm no fabricated success or duplicate delivery.

## Rollback

Stop creation/dispatch of new operator goals and disable its cron worker. Preserve the new data and existing customer state. Deploy the previous app revision if needed. Do not drop the additive tables. Reconcile UNKNOWN deliveries against provider logs before any human-authorized retry.

Only release after current-commit CI is green, target-host runtime checks pass, feature gaps are resolved and live evidence supports the promise that work continues after the tab closes.
