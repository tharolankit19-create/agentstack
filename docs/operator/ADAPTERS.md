# Governed read adapter builder

The Integrations screen connects the existing encrypted providers and creates a durable “Connect a tool” goal from a documentation URL. Existing customers' connector envelopes, Dodo mappings and agents are preserved.

## Execution

1. Review the discovery plan and start it. Kryx reads the real documentation, requests a structured JSON adapter from the model and validates endpoint evidence. No generated code is executed.
2. The leased task atomically writes the proposal, source artifact, completion and audit events. Paused or expired workers cannot write an adapter.
3. In Integrations, review the exact domains, GET endpoints, risk and input schemas. Supply example query inputs and create a sandbox test goal. Review and start its plan.
4. The sandbox makes bounded public HTTPS JSON reads, with no vault access or production credentials. Failed responses remain failed evidence. Completion means testing finished; installation requires a passing result.
5. Explicitly approve installation of the exact tested definition. The server and service-only database RPC bind installation to the immutable definition hash and a passing test less than seven days old.
6. After installation, optionally connect an API credential. It is AES-256-GCM encrypted with the existing vault key. Auth headers are assembled server-side; the model, browser response, trace and artifact never receive the credential.
7. Run a reviewed API read goal, or let the planner select the installed action for a matching outcome. Reads use the task's policy, idempotency reservation, budget, tool events and source-backed JSON artifact.

Disabling an adapter removes its credential and prevents new execution. A changed definition requires a new proposal. Duplicate installation acknowledgement produces one installation event.

## Safety boundary

This version executes **GET / READ adapters only**. Generated writes are blocked, even if a manifest labels them as safe. Model manifests cannot contain executable code or arbitrary headers. Endpoints are fixed; inputs are declared scalar query parameters. Undeclared inputs and credential query fields are rejected.

The HTTPS transport rejects private/metadata destinations, verifies every DNS result, pins one verified address for the actual TLS connection and does not follow redirects. It limits responses to 256 KB and 20 seconds and requires valid JSON. Public API smoke is exercised separately from the controlled product provider fixtures.

The kryx_tool_adapters table is owner-readable with RLS; direct authenticated lifecycle mutations are denied. The kryx_adapter_credentials table is service-only, has RLS with no browser policy, and is never exposed by the resources API. Owner checks and composite foreign keys isolate proposals, tasks and credentials.

## API

| Method and path | Result |
| --- | --- |
| GET /api/kryx/adapters | Owned definitions and credential-connected booleans |
| POST /api/kryx/adapters | Idempotent durable discovery goal |
| POST /api/kryx/adapters/:id/test | Idempotent credential-free sandbox goal |
| POST /api/kryx/adapters/:id/install | Exact hash + explicit approval + passing test |
| POST /api/kryx/adapters/:id/credential | Encrypted credential update or disconnect |
| POST /api/kryx/adapters/:id/run | Idempotent reviewed API read goal |
| PATCH /api/kryx/adapters/:id | Disable adapter and erase its credential |

Mutations are authenticated, owner-scoped, bounded, rate-limited and reject foreign origins. Credentials are entered only in the product's password field. Model-generated schemas and production credentials are separate objects.

## Current limits

There is no generic generated write executor, OAuth flow, path-template/body compiler, custom MCP installation or sandbox credential mode. APIs whose selected endpoints require authentication cannot pass the credential-free sandbox and remain uninstalled. A reliable native connector is still preferred where implemented; this builder does not make every requested integration production-ready.

Discovery needs configured model and page-reading providers. Rollout requires both additive migrations, the existing vault key and a confirmed Kryx database. The browser harness uses labelled fixture providers with a real persistent SQL store; it is not a live founder acceptance run.
