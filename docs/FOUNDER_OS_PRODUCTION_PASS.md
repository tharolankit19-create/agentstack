# Founder OS — production pass

This pass turns the Founder OS direction into bounded, testable product behavior.

## What is live in code

- Mission Control approval is an action, not a link. Generation approvals and written outreach leads move state immediately.
- Room has @ autocomplete and specialists report their completed work to Seamus in the shared thread.
- Team communication is bounded: specialists report shared artifacts; there is no unbounded bot-to-bot reply loop.
- Agent chat is durable. The founder's message is persisted before inference, history is loaded server-side after ownership is proven, and the model receives recent durable history plus the shared wiki.
- Founder chat remains concise by the shared style contract.
- Onboarding keeps GitHub optional, explains that it improves technical SEO quality, and never claims a pasted URL grants write permission.
- Morning/evening briefing times support HH:MM. The five-minute heartbeat checks briefing due state every tick and sends on the first tick after the selected minute.
- Market research checks every 30 minutes and only interrupts on a deduplicated urgent finding.
- A quiet diagnosis worker checks hourly and only messages Telegram when a new warning/blocker appears.
- Fish Audio hosted TTS is behind `FISH_AUDIO_API_KEY`, with `FISH_AUDIO_MODEL` and `FISH_AUDIO_VOICE_ID` overrides.
- Fish Audio ASR powers dashboard voice notes; assistant replies can be spoken with the configured Seamus voice.
- CI now runs `npm run typecheck` and `npm run build` on pull requests and main pushes.

## Required environment

```text
FISH_AUDIO_API_KEY=...
FISH_AUDIO_MODEL=s2.1-pro-free
FISH_AUDIO_VOICE_ID=8d21b053e2804e2a890e1cf62f267b6f
```

The existing five-provider model pool remains required separately.

## GitHub / SEO publishing safety

A repository URL in onboarding is context only. Daily SEO research/drafts can use it, but repository writes require a real GitHub connector with scoped permission. When that connector is implemented, the write allowlist is SEO content paths only; agents do not modify application code, auth, billing, infra or arbitrary product files.

SEO pages must remain approval-gated. Seamus may approve internal research/delegation, but cannot self-approve a public repository change.

## Launch directories

Do not automate browser form submissions just to manufacture links or DR. Automatic submission is allowed only when a directory exposes a supported API/integration and its rules allow automation. Otherwise create a founder approval queue containing the directory, required fields and prepared copy. Never claim a DR increase before it is measured.

## Analytics / Startup Health truth rule

Do not fabricate CAC, LTV, conversion, session duration, attribution, geography or funnel drop-off. Each metric needs a connected first-party source. Missing data renders `Not connected`; it is never filled by an LLM estimate.

## Still gated on external connectors

- GitHub OAuth/App installation for scoped SEO-page publishing.
- First-party product analytics/billing connectors for Startup Health and customer-friction/milestone alerts.
- Telegram inbound voice notes need Telegram file download -> Fish ASR wiring; dashboard voice notes are implemented already.
- True duplex live calls should use a real realtime transport (WebRTC/LiveKit/Pipecat + streaming ASR/TTS), not a fake call button.
