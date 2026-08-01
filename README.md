# AgentStack

Three AI marketing agents your customers deploy in one click. Hard paywall,
one-time price, no free plan.

A founder signs in with Google, pays $29, picks an agent, fills in four fields,
and clicks Deploy. Ninety seconds later that agent is live on its own URL,
running on a schedule, and they can talk to it from the dashboard. They never
see a terminal, a repo, or an environment file.

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
                 ├── Dodo Payments     one-time $29 / $59, webhook grants the plan
                 └── Vercel API ──▶ hermes-core deployment (one per agent)
                                          │
                                          ├── runs on cron
                                          ├── calls OpenAI with the customer's key
                                          └── reports runs back to /api/agents/callback
```

Each deployed agent is the whole `apps/hermes-core` source, uploaded to Vercel
with one environment variable — `ACTIVE_TEMPLATE` — deciding which of the three
agents it is. Nothing about the platform ships with it: no database URL, no
service-role key, no other customer's anything.

## The three agents

| Agent | What it does | Replaces |
|---|---|---|
| Content Agent | Reads your site, writes 5 tweets and 2 LinkedIn posts every weekday | Buffer, Hootsuite |
| Review Agent | Watches G2/Capterra/Trustpilot, drafts a reply to every new review | Birdeye, Reputation.com |
| Lead Agent | Pulls 25 ICP-matched leads from Apollo, writes the opening email | Clay, Instantly |

Each one is a folder under `apps/hermes-core/templates/`: a `config.json`, plain
`.txt` prompts, and its tools. Adding a fourth agent means adding a folder and
one line in `src/templates/registry.ts` — the agent loop never changes.

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

Two Vercel projects, both from this repo:

- **The SaaS** — root directory `apps/web`. This is the thing customers visit.
- Agent deployments are created by the API at runtime. You do not deploy
  `apps/hermes-core` yourself; it is the payload, not a site.

Point `NEXT_PUBLIC_APP_URL` at the SaaS URL, add the Dodo webhook endpoint
(`/api/webhooks/dodo`), and run `supabase/migrations/0001_init.sql`.

## Credit

The agent engine's design — folder-based skills, prompts as editable text, a
cron scheduler, a stable prompt prefix so provider caching survives a long
conversation, and a narrow core with capability at the edges — follows the
architecture of [Hermes Agent](https://github.com/NousResearch/hermes-agent) by
Nous Research.

## Licence

MIT.
