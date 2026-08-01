# Setup

Twenty minutes, four accounts. Do them in this order — later steps need values
from earlier ones.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste `supabase/migrations/0001_init.sql` → Run.
3. **Authentication → Providers → Google** → enable it. You need a Google Cloud
   OAuth client (Web application) with this redirect URI:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

4. **Authentication → URL Configuration** → set the Site URL to your app URL and
   add `https://your-app.vercel.app/auth/callback` to the redirect allow-list.
   Add `http://localhost:3000/auth/callback` too while you develop.
5. **Project Settings → API** → copy the project URL, the anon key, and the
   service role key.

Email sign-in works with no extra setup — Supabase sends the magic link.

## 2. The encryption key

This is what protects your customers' API keys.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save it as `SECRETS_ENCRYPTION_KEY`. **Rotating it later makes every stored
customer key unreadable** and they will all have to re-enter them, so put it
somewhere you will not lose it.

## 3. Dodo Payments

1. Create two **one-time** products: $29 and $59. Copy both product ids.
2. **Developer → API Keys** → create a key.
3. **Developer → Webhooks** → add an endpoint:

   ```
   https://your-app.vercel.app/api/webhooks/dodo
   ```

   Subscribe it to `payment.succeeded`. Copy the signing secret — it starts
   with `whsec_`.

Keep `DODO_ENVIRONMENT=test` until you are ready to charge real cards. The
client points at `test.dodopayments.com` or `live.dodopayments.com` based on it.

## 4. Vercel

You need a token that can create projects, because that is how customer agents
get deployed.

1. [vercel.com/account/tokens](https://vercel.com/account/tokens) → create a
   token with full scope on the account (or team) the agents should live in.
2. If the agents should live under a team, copy the team id from the team's
   settings and set `VERCEL_TEAM_ID`.

Each customer agent becomes its own Vercel project. On a Hobby account that
runs into project and cron limits quickly — use a Pro account if you plan to
sell more than a handful.

## 5. Fill in the environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Everything in that file is documented inline. The only optional ones are
`DEMO_OPENAI_API_KEY` (turns the landing-page demo on) and `VERCEL_TEAM_ID`.

## 6. Run it

```bash
npm install
npm run dev
```

- Landing page: <http://localhost:3000>
- Dashboard: <http://localhost:3000/dashboard> — redirects to pricing until a
  webhook grants you a plan.

To get into the dashboard locally without paying, sign in once, then run this
in the Supabase SQL editor:

```sql
update public.profiles
set plan = 'starter', agent_quota = 3, purchased_at = now()
where email = 'you@example.com';
```

## 7. Deploy the SaaS

Import the repo into Vercel with **root directory `apps/web`**. Add every
variable from `.env.local` to the project's environment, and set
`NEXT_PUBLIC_APP_URL` to the real production URL.

Do not create a Vercel project for `apps/hermes-core`. It is not a site you
host — it is the payload the deploy pipeline uploads, one copy per customer
agent.

## 8. Before you take real money

- [ ] Switch `DODO_ENVIRONMENT` to `live` and swap in the live product ids.
- [ ] Send a test webhook from Dodo and confirm the plan lands on the profile.
- [ ] Set `NEXT_PUBLIC_TWITTER_HANDLE`, `NEXT_PUBLIC_FOUNDER_NAME` and
      `NEXT_PUBLIC_SUPPORT_EMAIL` — the footer and the refund promise reference them.
- [ ] Put real quotes in `apps/web/src/lib/testimonials.ts`. The section stays
      hidden while it is empty, which is the correct behaviour, but a launch
      with no proof converts badly. Get five users first.
- [ ] Read `docs/SECURITY.md` and confirm the service role key is not in any
      `NEXT_PUBLIC_` variable.
