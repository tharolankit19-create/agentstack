# Founder feedback, voice and writing

## Feedback
The existing help widget offers a six-question interview for $2 (200 credits),
once per authenticated account. Answers save after each step and resume across
visits. The user explicitly starts the interview after seeing its purpose, who
can read it, and the review condition. Drafts and submitted answers are visible
to the admin, with usage counts captured by the server.

Admin: /dashboard/admin/feedback. Filters cover draft, submitted, rewarded and
rejected. Each interview shows the customer, full answers, usage context, review
note and improvement status. Review notes are visible to the customer; avoid
private internal notes. Every review decision is also recorded in feedback_reviews.

Specific negative feedback, setup failures and honest "nothing yet" responses
qualify. Do not require praise, testimonials, star ratings or a public review.
Repeated or brief answers are review prompts, not evidence of lying. If context
is unclear, decline with a specific reason; administrators can approve a rejected
interview later. This does not claim to prevent multiple-account/Sybil abuse.

The database owns the fixed award. The service-only review function checks the
reviewer's admin status, locks the interview, creates a unique grant, updates the
wallet and writes a zero-dollar topup in one transaction. Retries cannot award
twice. Customer JSON cannot choose reward amount, owner, questions or status.
The version check prevents two browser tabs from overwriting saved answers.

Apply supabase/migrations/0024_founder_feedback.sql to the existing database
before enabling this release. All routes use the current auth and service client.
No production migration has been run by this change.

## Fish Audio
Set server-only FISH_AUDIO_API_KEY and FISH_AUDIO_VOICE_ID.
FISH_AUDIO_MODEL defaults to s2.1-pro-free; unsupported model names are rejected
rather than allowing an upstream silent fallback. See docs/ENV_FISH_AUDIO.md.
Official contract: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech

Listen is available on agent-chat and Room replies. It shows preparation,
supports stop while preparing, cancels stale requests and cleans up audio URLs.
Only one reply plays at a time. Missing configuration is a visible error.
Credentials and a live provider call still need verification in the deployed
environment. Configuration code is not proof that a provider key is present.

## Writing and research
The general writing contract is derived from
ANKIT_MULTIPLATFORM_CONTENT_GROWTH_SYSTEM.md (27–28, 36–38).
Its source is apps/hermes-core/src/core/human-writing.ts; the runtime bundler
copies it to web's generated directory. Both completion boundaries apply it,
including one-shot post tools. Stock marketing phrases are rejected before
final delivery. Heuristics do not guarantee factual accuracy or perfect style.
Ankit's personal products, metrics and identity are not assigned to customers.
Platform posts request missing prior-day results; existing-draft edits and
ordinary conversation do not require analytics.

The existing integration is named Monid and uses MONID_API_KEY. It now serves
general and topic-specific research even without Firecrawl. Exact page fetches
remain distinct from search evidence. Failed reads never count as research.
No unverified MOREAD endpoint or key name was invented.

## Verification
CI runs mocked boundary tests, TypeScript and a production build. A Postgres
service tests customer isolation, RPC permissions, rollback on a missing wallet,
and concurrent approvals. Before production acceptance, also test the full
authenticated browser flow and real Fish/Monid credentials.

The earlier room execution repair is tracked separately in PR #26; this branch
preserves the newer main-branch UI.
