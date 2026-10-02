# AgentStack

**Cancel your SaaS. Keep the work.**

A library of agents, each one built to do the job of a SaaS product your
customer already pays for. They sign up, answer four questions, pick an agent, fill
in a few fields, and click Deploy. Ninety seconds later it is live on its own URL,
running on a schedule. They never see a terminal, a repo, or an environment file.

On Pro they can paste the URL of *any* tool we have not built an agent for. We
read its site and API docs, work out the job, and generate an agent that does
it — which the runtime then treats exactly like a built-in one.

```
agentstack/
├── apps/
│   ├── web/            the SaaS — landing page, paywall, dashboard, deploy pipeline
│   └── hermes-core/    the agent engine that gets deployed, once per agent
├── supabase/
│   └── migrations/     schema, RLS policies, quota enforcement
└── docs/               setup, architecture, security
```

## How it fits together

```
Customer ──▶ agentstack-web (your Vercel)
                 │
                 ├── Supabase          auth, agents, runs, encrypted keys
                 ├── Dodo Payments     $29 / $59 per month, webhook grants and revokes
                 └── Vercel API ──▶ hermes-core deployment (one per agent)
                                          │
                                          ├── runs on cron
                                          ├── calls OpenAI with the customer's key
                                          └── reports runs back to /api/agents/callback
```

Each deployed agent is the whole `apps/hermes-core` source, uploaded to Vercel
with one environment variable — `ACTIVE_TEMPLATE` — deciding which agent it is.
A generated agent sets `ACTIVE_TEMPLATE=custom-agent` and carries its whole
definition in `CUSTOM_AGENT_SPEC`. Nothing about the platform ships with it: no database URL, no
service-role key, no other customer's anything.

## The library

25 agents — five per category — each mapped to what it replaces and what that
costs per month. Replacing the lot is about **$2,232/month** of software.

| Category | Agents | Replaces |
|---|---|---|
| Content | Social Content, Blog, Newsletter, Repurpose, Video Script | Buffer, Hootsuite, Jasper, Mailchimp, Descript |
| Sales | Lead, Outreach, Proposal, CRM, Meeting | Apollo, Clay, Instantly, PandaDoc, Pipedrive, Otter |
| Support | Review, Support Inbox, Docs, Onboarding, Feedback | Birdeye, Intercom, Zendesk, Appcues, Canny |
| Marketing | SEO, Competitor, Landing Page, Ads, Community | Ahrefs, Semrush, Crayon, Unbounce, AdCreative |
| Operations | Analytics, Finance, Hiring, Changelog, Research | Databox, Baremetrics, Workable, Beamer, Perplexity |

Each is a folder under `apps/hermes-core/templates/`: a `config.json` and plain
`.txt` prompts. **Adding an agent adds no code** — the tools are shared
primitives in `src/tools/`, so a new agent is a folder and nothing else. The
build fails if a template names a tool or a prompt that does not exist.

Prices in `replaces.monthlyUsd` are the single source of truth for the savings
number on the landing page, in the calculator, and in the dashboard.

## Quick start

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then fill it in
npm run dev
```

Full setup — Supabase project, Google OAuth, Dodo products, Vercel token — is in
[`docs/SETUP.md`](docs/SETUP.md). It takes about 20 minutes.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | SaaS on :3000 |
| `npm run dev:agent` | Agent engine on :3001, for working on prompts and tools |
| `npm run build` | Production build of the SaaS |
| `npm run typecheck` | Both apps |
| `npm run bundle` | Regenerates the deployable agent bundle from `apps/hermes-core` |
| `npm run schema` | Regenerates `supabase/schema.sql` from the migrations |
| `npm run cron:secret` | Prints the token the heartbeat expects, to paste into GitHub |

## The clock

Everything this product does on its own — the morning briefing, the research
pulse, "at 5pm write the launch post", each squad doing today's job — is an
endpoint that does the work correctly and waits to be called. One schedule calls
them all:

```
every 5 min ──▶ /api/cron/heartbeat
                     │  which workers are overdue? (cron_ticks)
                     ├──▶ /api/cron/tasks      what the founder scheduled
                     ├──▶ /api/cron/agents     the squads' own cadences
                     ├──▶ /api/cron/briefing   when a founder's slot comes round
                     ├──▶ /api/cron/research   the pulse, alerts only if urgent
                     └──▶ /api/cron/playbook   lessons into the shared playbook
```

Due-ness is decided in the database against real timestamps, not against the
wall clock, so a heartbeat that arrives late — or not at all for a night — still
finds the overdue work on its next tick instead of skipping the slot until
tomorrow. Each agent runs on the cadence its own template declares: the review
agent every six hours, the SEO agent weekly, the content agent on weekdays.

**The clock lives inside the database.** pg_cron holds the schedule, pg_net
makes the call, and the migration generates its own bearer token — so there is
no environment variable to keep in sync and no second console to configure. Set
one field (`scheduler_config.app_url`) and it beats. GitHub Actions and Vercel
Cron still work if you prefer one, and running both is harmless.

Wiring it up is [step 8 of `docs/SETUP.md`](docs/SETUP.md).

## When it isn't working

Message the Telegram bot **`diagnose`**. It reads the real state and answers
with what is actually blocking the work — a stopped clock, no model key, a
lapsed trial, agents paused, a connector key the provider rejects — and the fix
for each, worst first. `/api/health` reports the same clock state for whoever is
looking after the deployment.

## How the squads reach the world

One key, hundreds of tools. [Monid](https://monid.ai) is a single catalogue in
front of the data providers — people, companies, social, reviews — so a
capability is chosen per job at run time instead of needing a separate account
per provider at signup.

The army asks for a *need* ("b2b people search"), not a vendor. Discovery picks
the endpoint, `inspect` returns its real input schema, and the parameters are
mapped onto whatever that provider happens to call them. When the search term
cannot be placed in that schema the run is abandoned before it starts — firing
at a schema nobody understood spends the founder's balance to produce something
nobody can read.

A founder's own key wins over the platform's wherever they have one: their
Apollo seat is already paid for, and a Monid run is not.

## Where the secrets live

Customer API keys are encrypted with AES-256-GCM before they reach Postgres,
using a key held only in the platform's server environment. They sit in
`agent_secrets`, a table with RLS enabled and **no policies** — unreachable with
an anon or authenticated key, service role only. They are decrypted exactly
once, at deploy time, and written straight into that agent's own encrypted
Vercel environment.

They are never returned to a browser, never written to a log, and never placed
in a message the model can see. Details in [`docs/SECURITY.md`](docs/SECURITY.md).

## Deploying

One Vercel project. Import this repo and set **Root Directory to `apps/web`**
in the project settings — leave the build and install commands empty, the
defaults are right. That single setting is the entire deployment configuration;
`docs/SETUP.md` explains the two errors you get if it is wrong.

Agent deployments are created by the API at runtime. You do not deploy
`apps/hermes-core` yourself — it is the payload, not a site.

Point `NEXT_PUBLIC_APP_URL` at the SaaS URL, add the Dodo webhook endpoint
(`/api/webhooks/dodo`), and paste `supabase/schema.sql` into the Supabase SQL
editor once.

## Credit

The agent engine's design — folder-based skills, prompts as editable text, a
cron scheduler, a stable prompt prefix so provider caching survives a long
conversation, and a narrow core with capability at the edges — follows the
architecture of [Hermes Agent](https://github.com/NousResearch/hermes-agent) by
Nous Research.

## Licence

MIT.
