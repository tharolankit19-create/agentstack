# Architecture

## Two apps, one job each

`apps/web` is the business: landing page, paywall, dashboard, deploy pipeline.
It is the only thing with database credentials.

`apps/hermes-core` is the product: an agent loop, a shared tool registry, a
catalog of twelve templates, and four API routes. It is never deployed by you —
it is uploaded, once per customer agent, by the deploy pipeline.

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

## Why tools are shared, not per-template

Every agent in the catalog is built from eight primitives in `src/tools/`:
`read_page`, `api_request`, `draft`, `list_prompts`, `publish`, `send_email`,
`notify`, `find_leads`, `check_reviews`. Twelve agents do not mean twelve
scrapers — they mean twelve prompt sets pointed at the same tools.

This is what makes the catalog cheap to extend: **adding an agent adds no
code**, only a folder. It is also the only reason a *custom* agent works at
all — an agent generated at runtime from a customer's SaaS cannot ship
bespoke TypeScript, so it has to be expressible in primitives that already
exist. `api_request` is the important one: it turns "the customer pasted their
existing API key" into a working integration with no vendor-specific code.

A serverless bundle cannot `import()` a path it only learns at runtime, so
`src/tools/index.ts` registers them statically and the loader resolves
`config.json`'s tool names against that map. `scripts/build-runtime-bundle.mjs`
fails the SaaS build if any template names a tool or prompt that does not
exist — a typo in a config should not become an agent that silently stops
working at 9am.

Prompts and config stay on disk and are read with `fs` at runtime, which is why
`next.config.ts` pins `templates/**` into every function with
`outputFileTracingIncludes`. Keeping prompts as plain text means a founder can
fork the repo and change their agent's voice without touching TypeScript.

## Custom agents

A Pro customer gives us a URL. `lib/custom-agent.ts` reads the homepage, follows
links that look like docs, and hands up to six pages to a model that returns a
spec: name, system prompt, scheduled task, and any API endpoints it *actually
saw documented*. The model's output is input, not truth — `normalize()` clamps
every field, refuses a base URL it cannot parse, and caps a price the model may
have misread off an annual plan.

That spec ships to the deployment as `CUSTOM_AGENT_SPEC`, and
`src/templates/custom.ts` turns it into a `LoadedTemplate`. From the loader
down, the runtime cannot tell a generated agent from a built-in one: same loop,
same tools, same scheduler, same callback.

## Memory

A deployed agent is a serverless function; process memory does not survive
between invocations. Durable history lives in Supabase and arrives with each
request. `src/core/memory.ts` owns only what is local to a run: assembling the
transcript and keeping it inside the context window.

The trimming rule matters. When a transcript gets long, the head and tail are
kept and the middle is dropped with a marker — never the prefix, because that
is what the provider cache is keyed on. Tool results whose requests were dropped
are also removed, since a dangling `tool` message confuses every provider.

## Subscriptions

Access is a state that changes underneath you, not a receipt checked once. The
Dodo webhook is the only place that grants or revokes it, and it does both:

- Grant events set `plan` and `agent_quota` and unpause the customer's agents.
- Revoke events set `agent_quota = 0`, which fires a database trigger that
  pauses every agent they own. Their configuration and history are untouched —
  deleting someone's work because a card expired is hostile, and resubscribing
  turns everything back on.
- A cancellation with a future period end is deliberately *ignored* at the time
  it arrives. The customer paid through a date; the `subscription.expired` event
  at that date does the revoking.

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
