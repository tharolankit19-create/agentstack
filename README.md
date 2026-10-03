# KryxAI

**Your always-on AI marketing operator.**

Give Kryx an outcome. It creates a plan, coordinates persistent tasks, uses supported tools and an isolated browser, stores evidence and drafts, and requests approval for consequential actions.

This repository contains the existing AgentStack product plus an additive operator implementation. The transformation is **in draft**: the feature gaps and production/live acceptance gates in [the implementation report](docs/operator/REPORT.md) must be closed before claiming the full product promise.

## Product and execution

The primary workspace centers Goals, Tasks, Skills, Routines, Memory, Artifacts, Integrations, Activity, Computer and Approvals. Specialist workers are selected behind Kryx. Existing agents/customer data remain available.

| Path | Responsibility |
| --- | --- |
| `apps/web/src/lib/operator` | DAG contracts, worker execution, provider routing, approval policy and durable store |
| `apps/web/src/app/api/kryx` | Authenticated owner-scoped goals, resources, approvals and webhook endpoints |
| `apps/web/src/components/operator` | Goal composer, reviewed plans, task activity, evidence and decisions |
| `apps/computer-runtime` | Isolated Chromium profile/files, trusted broker and restricted egress |
| `supabase/migrations` | Existing schema plus additive operator tables and lease-fenced RPCs |
| `apps/hermes-core` | Preserved narrow agent engine and legacy per-agent deployment |
| `tests/operator` | SQL-backed reliability, policy and controlled product-flow verification |

## Verification

Use Node 24 for the test loader.

```sh
npm ci
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:playwright
npm run build
node tests/operator/landing-smoke.mjs
```

The Playwright task harness uses controlled provider fixtures with real product components and PGlite SQL persistence. It is separate from the live acceptance tests. The landing capture tests the built Next.js application.

A configured Docker host must also pass `node apps/computer-runtime/smoke.mjs` with browser sandboxing enabled. Production credentials belong in the existing encrypted connector vault/hosting secret manager.

## Implementation and release evidence

- [Architecture, migration, acceptance coverage and remaining limitations](docs/operator/REPORT.md)
- [Exact changed files](docs/operator/FILES.md)
- [Deployment and five live acceptance exercises](docs/operator/DEPLOYMENT.md)
- [Draft PR #60](https://github.com/tharolankit19-create/agentstack/pull/60)

Pricing remains compatible with existing Dodo product IDs and the inspected billing configuration. New capacity tiers are data/configuration work, not a hardcoded price change.

The [preserved legacy infrastructure guide](docs/legacy-agentstack.md) documents the original deployment architecture. Its agent-first positioning and historical pricing examples are not the primary Kryx product story or billing source of truth.
