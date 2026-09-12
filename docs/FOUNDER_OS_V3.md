# Founder OS v3 — small surface, strong internals

This document is the implementation contract for the next AgentStack pass. It is intentionally stricter than a feature wishlist: nothing should appear in the founder UI until the data path behind it is real.

## 1. Provider mesh

Default providers are limited to five:

- AIRouter
- AiCredits
- OrcaRouter
- Z.ai
- OpenRouter

Seamus route:

1. AIRouter `google/gemini-3.7-flash`
2. AiCredits `deepseek/deepseek-v4.1-flash`
3. OrcaRouter `deepseek/deepseek-v4-flash-free`
4. Z.ai `glm-4.7`
5. OpenRouter strongest configured free model

Specialists have stable primaries but fall through the same provider-diverse mesh. A provider/model is benched only after a real failed inference. Never disable unrelated providers because one route returns 401/402/429/5xx.

Required Vercel variables:

- `AIROUTER_API_KEY`
- `AICREDITS_API_KEY`
- `ORCA_API_KEY`
- `ZAI_API_KEY`
- `OPENROUTER_API_KEY`

Optional overrides:

- `AIROUTER_BASE_URL`
- `AICREDITS_BASE_URL`
- `ORCA_BASE_URL`
- `ZAI_BASE_URL`
- `OPENROUTER_BASE_URL`
- `AIROUTER_HEAD_MODEL`
- `AICREDITS_HARD_MODEL`
- `ORCA_HARD_MODEL`
- `ZAI_HARD_MODEL`
- `OPENROUTER_TOP_FREE_MODEL`
- `OPENROUTER_FAST_MODEL`

## 2. Founder surface

Do not expose the internal org chart as the primary UX.

Founder sees four primary surfaces:

1. **Seamus** — one conversation and the daily brief.
2. **Mission Control** — only items that need a decision/approval.
3. **Startup Health** — traffic, conversion, funnel and customer-friction signals.
4. **Content / Search** — drafts, research and SEO pages waiting for approval.

Specialist agents are visible as provenance (`researched by Ida`, `SEO draft by Wren`) but not as eight competing chat inboxes.

## 3. Internal collaboration

Do **not** create an unrestricted agent-to-agent chat loop. It is expensive, hard to debug and can self-trigger forever.

Use bounded delegation instead:

- Seamus creates a task with an owner, deadline/TTL and expected artifact.
- Specialist writes the artifact and a <= 2 sentence handoff.
- Handoff goes to Seamus, not directly into another infinite chat.
- Seamus may approve low-risk internal analysis automatically.
- Public, outbound, destructive or repository-write actions remain founder-approved unless the founder explicitly changes that policy.
- Every delegation chain has a max hop count of 3.

The founder-facing room should therefore feel like one Seamus chat, while internal handoffs stay visible in an expandable activity trace.

## 4. Daily brief

Morning and evening, Seamus sends a compact brief, not a dashboard dump:

- what changed
- what shipped (including approved SEO pages)
- visitor/conversion movement
- biggest customer-friction signal
- one next action

Then ask one useful follow-up, e.g. `Want the traffic breakdown or the drop-off details?`

Never claim activity that has no recorded artifact/event.

## 5. Startup Health

Do not calculate metrics from guesses. Each card must expose its source and last-updated time.

### Core cards

- unique visitors
- signup/start-trial conversion
- paid conversion
- activation rate
- retention / churn when billing identity exists
- MRR/ARR when billing data exists
- ARPU and LTV only when the necessary cohort/billing data exists
- CAC only when spend attribution exists
- top sources / campaigns
- landing-page conversion by source
- median session duration when analytics provides it
- funnel drop-off by step
- top geographies

### Customer-friction feed

Agents may summarize:

- repeated exits on the same step
- error spikes
- rage/repeat clicks when the connected analytics source exposes them
- failed checkout/auth/onboarding events
- source-specific low-quality traffic

Every insight includes evidence. If a connector cannot supply a metric, show `Not connected` instead of synthesizing a number.

## 6. GitHub and SEO publishing

Onboarding may accept an optional repository URL, but a URL is **not** write permission.

Actual publishing requires GitHub OAuth/App installation with explicit repo scope.

Repository write policy:

- default writable area is SEO content only
- no product-code refactors
- no dependency changes
- no config/secrets changes
- create branch + commit + PR by default
- Seamus presents title, target query, evidence, files changed and diff summary for founder approval
- direct-to-main publishing is opt-in only

## 7. Voice / call architecture

The founder experience has three modes in the same Seamus surface:

- **Type**
- **Voice note**
- **Call**

### Voice note

1. browser records audio
2. STT produces text
3. text goes through the exact same Seamus chat/action pipeline
4. answer is returned as text and optionally TTS

### Call

1. WebRTC/browser audio session
2. streaming VAD + STT
3. short-turn Seamus model route
4. streaming TTS
5. transcript/event log saved with founder consent
6. action items extracted after the call

Do not add a fake call button before STT/TTS/realtime paths are wired and tested.

### Fish Audio

Fish Audio can own TTS once its repository/API contract is provided. Required adapter boundary:

```ts
interface SpeechProvider {
  synthesize(input: {
    text: string;
    voiceId?: string;
    format?: "mp3" | "wav";
  }): Promise<{ audio: Uint8Array; contentType: string }>;
}
```

Keep Fish-specific endpoints/model ids behind env/config. Do not hard-code undocumented URLs.

## 8. Performance budget

Target founder interactions:

- navigation feedback: <100ms
- route shell visible from cache/prefetch: <500ms typical
- chat send optimistic echo: immediate
- provider HTTP failure failover: immediate
- per-provider inference timeout: <=12s for chat, <=20s for research jobs
- first useful status update: <1s

Rules:

- never block navigation on agent work
- load dashboard sections independently
- prefetch primary routes
- do not refetch room history after every optimistic send when append data is enough
- keep research off the critical chat path unless the question needs it
- cache business context/recent brief for short TTLs

## 9. Approval policy

Seamus may auto-approve:

- internal analysis
- research synthesis
- draft creation
- metric refreshes
- low-risk scheduling changes inside founder-set limits

Founder approval required by default:

- publish SEO page / GitHub write
- send email/DM
- launch or change paid ads
- billing/pricing changes
- deleting data
- changing credentials/connectors

This gives the army autonomy without giving it silent authority over the founder's public surface.
