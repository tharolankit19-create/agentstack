# Security

The product asks customers to hand over API keys that can spend their money.
This is what happens to them.

## Threat model

The things worth defending, in order:

1. **Customer API keys.** An OpenAI key is a credit card. An Apollo key is a
   data-export budget. These are the crown jewels.
2. **Cross-tenant reads.** Customer A must never see customer B's agents,
   drafts, leads, or runs.
3. **Free access.** The dashboard is the product. Getting in without paying is
   theft of the thing being sold.

## Where keys live, end to end

```
browser form
   │  HTTPS, POST /api/agents/[id]  (password inputs, autocomplete off)
   ▼
route handler
   │  sealSecrets() → AES-256-GCM with SECRETS_ENCRYPTION_KEY
   ▼
Postgres: agent_secrets.ciphertext
   │  RLS enabled, zero policies → service role only
   ▼
deploy pipeline
   │  openSecrets() — decrypted exactly once, in memory
   ▼
Vercel project env, type "encrypted"
   │
   ▼
the running agent: process.env.OPENAI_API_KEY
```

Four properties fall out of this:

- **A database dump is ciphertext.** The encryption key is not in the database.
- **A leaked service-role key is not enough.** It reads ciphertext.
- **The browser can never read a key back.** They are write-only from the UI's
  point of view; the form shows "saved" and takes a replacement, never a value.
- **The model never sees them.** Tools receive a `secret()` accessor, and
  everything a tool returns goes through `redact()` before it enters the
  transcript.

## Row Level Security

Every table has RLS on. The policies are ownership checks against `auth.uid()`.

`agent_secrets` is the exception worth understanding: RLS is enabled and there
are **no policies at all**. In Postgres that means no `anon` or `authenticated`
request can read, write, or even count rows in it. Only the service role, which
bypasses RLS, can — and the service role key lives in the platform's server
environment.

The `agent_stats` view is declared `security_invoker = on`, so it runs with the
caller's RLS rather than the view owner's. Without that flag a view is a hole
straight through RLS.

## The paywall

Three layers, because one is a bug away from being none:

1. **Middleware** — no session, no `/dashboard`. Cheap, runs on the edge.
2. **`requirePaidUser()`** — re-reads `profiles.plan` from Postgres on every
   dashboard render. A cookie proves identity, not payment.
3. **`requirePaidApiUser()`** — the same check on every API route that costs
   money, returning 402 rather than redirecting.

Entitlements are granted in exactly one place: the Dodo webhook handler. There
is no code path where the client can set its own plan — the `profiles` UPDATE
policy explicitly forbids changing `plan` or `agent_quota`, so even a crafted
request with a valid session cannot self-grant.

## Payment webhooks

- Unsigned means untrusted. Standard Webhooks HMAC verification, and a missing
  `DODO_WEBHOOK_SECRET` rejects everything rather than defaulting open.
- Replays are idempotent: the event id is the primary key of `webhook_events`,
  so the second delivery loses the insert and returns early.
- Storage failures return 500 so the provider retries. Swallowing an error here
  means someone paid and cannot get in.

## Agent callbacks

Deployed agents report their runs to a public endpoint. It is safe because an
agent can only write rows for itself:

- The agent id comes from the `x-agent-id` header, not the body.
- The bearer token is checked against that agent's stored SHA-256 hash with a
  constant-time comparison.
- Every row written is stamped with the `user_id` read from the database for
  that agent — a body claiming a different `agentId` is rejected outright.
- Tokens are minted fresh on every deploy.

## SSRF

Two routes fetch a URL a stranger supplied: the landing-page demo and the
agents' scraping tools. Both refuse `localhost`, loopback, link-local,
RFC1918 ranges, `.internal`, and `metadata.google.internal`, and both accept
only `http`/`https`.

## Rate limits

In-memory, per instance — deliberately. It caps the blast radius of a script
hammering the free demo without adding a Redis dependency to a product that
does not otherwise need one. The limits:

| Route | Limit |
|---|---|
| `/api/demo` | 3 per IP per hour |
| `/api/checkout` | 10 per IP per 10 minutes |
| `/api/agents/[id]/deploy` | 12 per user per hour |
| `/api/agents/[id]/chat` | 60 per user per hour |
| `/api/agents/[id]/run` | 20 per user per hour |

If the demo ever gets seriously abused, swap the store in `lib/rate-limit.ts`
for Upstash. No call site changes.

## What a compromised agent deployment gets you

One customer's own API keys, and nothing else. The deployment receives no
Supabase URL, no service role key, no other agent's token, and no platform
credential. That isolation is the reason the callback pattern exists instead of
handing each agent a database connection.

## Known limits

- **Rate limiting is per-instance.** Documented above; acceptable for the
  traffic this is built for, not for a public API.
- **`agent_token_enc` is reversible by design.** The platform must present the
  token when it forwards a chat turn, so it cannot be hash-only. It is
  encrypted with the same vault key as the customer secrets.
- **The legal pages are a starting point.** Have a lawyer read them before
  selling into the EU or California.

## Verifying a deployment

`GET /api/health` is public and reports booleans only — which environment
variables are set, whether the database answers, whether the migration ran. No
value or fragment of a value is ever included, which is what makes it safe to
leave open.

```bash
curl -s https://your-app.vercel.app/api/health | jq
```

It returns 503 until every required variable is present and the database
responds. Note that it does a real `SELECT`, not a `HEAD` — PostgREST sends no
error body on a HEAD, so a missing table would otherwise read as success. A
health check that reports green while the schema is absent is worse than none.
