# Architecture

## Two apps, one job each

`apps/web` is the business: landing page, paywall, dashboard, deploy pipeline.
It is the only thing with database credentials.

`apps/hermes-core` is the product: an agent loop, three templates, four API
routes. It is never deployed by you — it is uploaded, once per customer agent,
by the deploy pipeline.

They share nothing at runtime. The only link is a build step:
`scripts/build-runtime-bundle.mjs` freezes the engine's source into
`src/generated/runtime-bundle.json` and its template configs into
`src/generated/templates.json`. That is why the dashboard's config form and the
deployed agent's behaviour can never drift — they read the same `config.json`.

## The agent loop

```
loadTemplate()          config.json + prompts/*.txt + tools from the registry
  ↓
buildSystemPrompt()     stable prefix: system prompt + settings + date
  ↓
┌─ complete()           model call with the tool schemas
│    ↓
│  tool_calls?  ──no──▶ done, return the final text
│    ↓ yes
│  run tools in parallel, append results
└──── repeat, up to maxIterations
```

Two properties are borrowed straight from Hermes and are worth keeping:

**The prompt prefix never mutates.** System prompt and tool schemas are built
once per run. Nothing swaps toolsets or rewrites history mid-conversation, so a
provider's prompt cache keeps hitting across a long chat. Breaking this
multiplies the customer's model bill for no visible benefit.

**The core is a narrow waist.** `src/core/` knows nothing about tweets,
reviews, or leads. Every model tool is sent on every API call, so capability
belongs in templates, not in the loop. A fourth agent is a folder plus one line
in `src/templates/registry.ts`.

## Why tools are registered statically

Template folders contain their own `tools/*.ts`, which is where they belong —
next to the prompts that use them. But a serverless bundle cannot `import()` a
path it only learns at runtime, so `src/templates/registry.ts` imports them
statically and the loader resolves `config.json`'s tool names against that map.

Prompts and config stay on disk and are read with `fs` at runtime, which is why
`next.config.ts` pins `templates/**` into every function with
`outputFileTracingIncludes`. Keeping prompts as plain text means a founder can
fork the repo and change their agent's voice without touching TypeScript.

## Memory

A deployed agent is a serverless function; process memory does not survive
between invocations. Durable history lives in Supabase and arrives with each
request. `src/core/memory.ts` owns only what is local to a run: assembling the
transcript and keeping it inside the context window.

The trimming rule matters. When a transcript gets long, the head and tail are
kept and the middle is dropped with a marker — never the prefix, because that
is what the provider cache is keyed on. Tool results whose requests were dropped
are also removed, since a dangling `tool` message confuses every provider.

## Deploy pipeline

```
deployAgent(agent)
  1. read agent_secrets, decrypt          ← the only plaintext moment
  2. mint a fresh bearer token
  3. build the env: ACTIVE_TEMPLATE, AGENT_ID, AGENT_TOKEN,
     AGENTSTACK_CALLBACK_URL, SETTING_* , the customer's keys
  4. create or reuse the Vercel project (reused, so URLs are stable)
  5. rewrite vercel.json with this agent's cron expression
  6. upload files (SHA-1 deduped by Vercel), create the deployment
  7. persist project id, deployment id, token hash + encrypted token
```

Deployments are made by uploading source files, not by creating a GitHub repo
per customer. A git-based pipeline would add a second provider, a second set of
tokens, and a second thing that can rate-limit — in exchange for nothing the
customer can see.

Build state is polled from `/api/agents/[id]/status` rather than received by
webhook. One less public endpoint.

## Scheduling

Vercel Cron pings the agent's `/api/schedule` on the expression written into its
`vercel.json` at deploy time. The runtime then applies two gates: `AGENT_PAUSED`
(so the dashboard's Stop toggle works without a redeploy) and the customer's
coarse frequency setting (a "Mondays only" agent still gets pinged, and
declines).

## Data flow for one scheduled run

```
Vercel Cron ─▶ agent /api/schedule
                  ├─ decide() → should this tick run?
                  ├─ runAgent(template.scheduledTask)
                  └─ reportRun() ─▶ agentstack /api/agents/callback
                                        ├─ verify token against the hash
                                        ├─ insert agent_runs
                                        ├─ insert generations
                                        └─ update agents.last_run_at
```

The customer sees the drafts in their dashboard the next time they open it. The
agent never held a database credential to put them there.
