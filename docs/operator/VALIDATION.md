# Verification evidence

Tested code commit: `88091dc2842d04643784463c820480bbe3a99297`.

[Operator CI run](https://github.com/tharolankit19-create/agentstack/actions/runs/37011423959) completed successfully on 2026-10-02. The ordinary repository CI run also succeeded. Vercel reported a successful preview build; no production release/merge or database migration was performed.

| Check | Result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Pass | Hermes core and Next.js |
| `npm test` | 36 pass, zero failures | 32 operator/PGlite tests and 4 runtime policy tests |
| `npm run test:playwright` | 2 pass | Actual product components with explicit controlled providers and SQL-backed API harness |
| `npm run build` | Pass | Production Next.js application |
| Built landing smoke | Pass | Actual built Next.js desktop/mobile page; viewport overflow and screenshots |
| Docker image/Compose | Pass | Runtime image build and real broker/proxy startup |
| Runtime public capture | Pass | Sandboxed Chromium, real permitted page PNG/text, metadata denial |
| Tenant isolation and restart | Pass | Distinct named volumes, resource controls, single internal tenant network, denied cross-tenant file read/traversal, disabled terminal, file/profile persistence after runtime restart |
| Live founder acceptance 1–5 | Pending | Correct Kryx database, real connected providers, deployed scheduler/runtime, native analytics and approved edit/deployment path required |

## Screenshots

Download **kryx-product-evidence** from the verification run's Artifacts section. Artifact ID: `11228625697`. ZIP SHA-256: `f5954fde206a37435f3b37c750581a3ae8a6688fd7ad3d34b41cbc5a61fdbb89`. Retention expires 2026-12-31.

The ZIP includes:

- `docs/operator/screenshots/plan.png`
- `docs/operator/screenshots/artifacts-and-approvals.png`
- `docs/operator/screenshots/mobile-home.png`
- `docs/operator/screenshots/landing-desktop.png`
- `docs/operator/screenshots/landing-hero.png`
- `docs/operator/screenshots/landing-mobile.png`

The first three use visibly labelled QA provider fixtures. The landing images capture the production build with no invented work metrics. Automated screenshot capture is evidence of rendering; it is not proof of live prospect research, email delivery or production deployment.

## Release status

The requested complete transformation remains unfinished. See [REPORT.md](REPORT.md) for feature gaps and [DEPLOYMENT.md](DEPLOYMENT.md) for target-host and live acceptance gates. Existing users, customer tables, encrypted keys and billing mappings were preserved.

A documentation-only follow-up may point at this immutable tested code commit. Any source change requires renewed verification.
