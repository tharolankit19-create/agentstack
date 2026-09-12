# Agent Army v2 — operating system

## Product rule

The founder does not configure an AI org chart. They give us a site and start talking. The army has one growth lead and seven specialists. Each specialist has one stable primary provider/model. A fallback is an outage path, not a personality change.

The default army is intentionally small:

| Role | Template | Primary assignment | Main skills |
|---|---|---|---|
| Growth Lead | `head-agent` | NVIDIA / `moonshotai/kimi-k3` | planning, delegation, synthesis, prioritisation |
| Market Researcher | `research-agent` | APINex / `free/gemini-3.8-flash` | customer research, competitor intel, communities, trend verification |
| Experiment Analyst | `analytics-agent` | Routeway / DeepSeek V4 Flash Free | funnel analysis, experiment design, content performance, scoring |
| Content & Distribution | `content-agent` | APINex / `free/gpt-5.6-luna` | X, LinkedIn, Threads, Instagram, YouTube, Medium, email, ads, repurposing |
| Search & Authority | `seo-agent` | Z.ai / `glm-4.7` | SEO, AEO, GEO, long-form search, docs, internal links |
| Conversion Editor | `landing-agent` | Routeway / Kimi K2.6 Free | landing, pricing, onboarding, offer/CRO |
| Lead Hunter | `lead-agent` | Routeway / MiniMax M2.7 Free | lead search, qualification, CRM scoring, trigger research |
| Outreach Writer | `outreach-agent` | APINex / `free/qwen-3.8-max` | personalised outbound drafts, follow-ups |

All provider/model assignments are env-overridable. If a provider changes a free model id, update the env value instead of changing product logic.

## Why not 25 default agents?

Repurposer, blog writer, newsletter writer, ads writer, video scripter, competitor watcher, community scanner, feedback filter, CRM scorer, docs writer and similar jobs are skills, not separate colleagues. Splitting every skill into a worker adds handoffs, latency and repeated context. Those old templates remain available for custom/on-demand use, but they are not in the default roster.

## Routing rules

1. Pin the role to one primary provider/model.
2. Keep the same physical model for a single call/tool loop. Do not model-shop halfway through work.
3. Treat real inference success as health truth. A dashboard saying `free`, `live` or showing account balance is not a health check.
4. On timeout, 404, 429, 5xx, auth/quota failure or unusable output, bench only that `(provider, model)` temporarily and move to a different provider.
5. Provider-diverse fallback order: NVIDIA -> Z.ai -> Routeway -> APINex -> NaraRouter -> Token Harbor -> OpenRouter, skipping the primary and any provider without credentials.
6. No infinite retries. One candidate gets one attempt in a request. Quality repair is a separate bounded call.
7. Do not expose model/provider names or routing failures to normal founder chat. Give one useful line. Detailed diagnostics belong in operator telemetry.
8. APINex, NaraRouter and Token Harbor stay configuration-driven where public endpoint/model identity is not sufficiently stable to hard-code. Passing a smoke/eval gate matters more than the marketing name on the dashboard.

## Environment variables

### Providers

```bash
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

ROUTEWAY_API_KEY=
ROUTEWAY_BASE_URL=https://api.routeway.ai/v1
ROUTEWAY_DEEPSEEK_MODEL=
ROUTEWAY_KIMI_MODEL=
ROUTEWAY_MINIMAX_MODEL=

ZAI_API_KEY=
ZAI_BASE_URL=https://api.z.ai/api/paas/v4

APINEX_API_KEY=
APINEX_BASE_URL=

NARAROUTER_API_KEY=
NARAROUTER_BASE_URL=
NARAROUTER_MODEL=

TOKENHARBOR_API_KEY=
TOKENHARBOR_BASE_URL=
TOKENHARBOR_MODEL=

OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

### Per-role overrides

```bash
AGENT_MODEL_HEAD=moonshotai/kimi-k3
AGENT_MODEL_RESEARCH=free/gemini-3.8-flash
AGENT_MODEL_ANALYTICS=
AGENT_MODEL_CONTENT=free/gpt-5.6-luna
AGENT_MODEL_SEO=glm-4.7
AGENT_MODEL_CRO=
AGENT_MODEL_LEADS=
AGENT_MODEL_OUTREACH=free/qwen-3.8-max
```

For Routeway, set the three model envs to the exact ids returned by that account's `/models` endpoint. Do not guess a slug in production.

## Conversation contract

The army mirrors the founder's language and level of formality. Hinglish in means natural Hinglish out; Hindi in means Hindi; English in means English. It mirrors pace, not mistakes. A short question gets a short answer. A deep audit can be long.

The tone is a sharp founder friend, not customer support. No `Sure!`, no question restatement, no generic AI preamble, no hidden reasoning, no tool syntax and no provider/model disclosures.

## Marketing skill doctrine

The content/research rules come from the product's research playbook:

- proof first, product second;
- use real screenshots, first-party numbers, shipped changes and exact customer language;
- no fake metrics, customers, scarcity, authority or social proof;
- one idea per piece and one major variable per experiment;
- adapt natively per platform instead of cross-posting the same sentences;
- trends only when the target customer cares;
- GEO/AEO is clear entity + clear answer + evidence + crawlable page + consistent facts, not a bag of hacks;
- memes are allowed only when the audience recognises the reference instantly and the punchline is a specific founder pain;
- hard CTA is earned by proof, not used as a default.

## Two-screen onboarding

Screen 1: founder name.

Screen 2: company (optional), website (required), X handle (optional).

That is enough to create the whole team. The research agent infers ICP and competitors from live work; the founder corrects it later. No model picker, API picker, agent configuration or marketing questionnaire is shown to the customer.

## Quality/eval gate before provider promotion

For every primary route, run at least these checks before calling it healthy:

1. short founder chat in English, Hindi and Hinglish;
2. research synthesis with three cited/dateable facts;
3. content rewrite that preserves a supplied founder voice sample;
4. structured lead ranking without invented contacts;
5. 5-turn context continuity;
6. timeout/rate-limit failover to a different provider;
7. no chain-of-thought/tool syntax in founder-visible output;
8. task completion and latency recorded per `(provider, model, agent role)`.

Promote or demote a model from observed task quality and reliability, not a leaderboard name alone.
