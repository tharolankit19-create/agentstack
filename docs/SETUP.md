# Setup

Twenty minutes, four accounts. Do them in this order — later steps need values
from earlier ones.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → **New query** → paste the whole of **`supabase/schema.sql`**
   → **Run**. That one file is every migration concatenated in order, so a
   fresh project needs a single paste.

   Everything lands in a schema called **`agentstack`**, not `public`. That
   means you can install this into a project that is already running something
   else — no migration in this repo drops, alters, or reads a single object
   outside its own schema. The one thing it adds elsewhere is a trigger on
   `auth.users`, and it is named `agentstack_on_auth_user_created` so it sits
   alongside anything already there rather than colliding with it.

   A project API key cannot create tables, so this step needs either the
   dashboard or a Management API token (`sbp_…`). Thirty seconds, once.

   **If you skip it, the app tells you so** — it detects the missing schema and
   shows these instructions instead of failing silently.

3. **Settings → API → Exposed schemas**: add **`agentstack`** to the list next
   to `public` and `graphql_public`.

   Miss this and every query fails with `PGRST106`, because PostgREST will not
   serve a schema it has not been told about — the tables exist and are simply
   invisible.

   Verify both steps landed:

   ```bash
   curl -s "https://<your-ref>.supabase.co/rest/v1/profiles?select=id&limit=1" \
     -H "apikey: <your-secret-key>" -H "Authorization: Bearer <your-secret-key>" \
     -H "Accept-Profile: agentstack"
   ```

   `[]` means it worked. `PGRST205` means the SQL did not run; `PGRST106`
   means the schema is not exposed.
4. **Authentication → Providers** → enable **Email** (with "Confirm email" on
   or off, your call — the signup form handles both) and **Google**. You need a Google Cloud
   OAuth client (Web application) with this redirect URI:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

5. **Authentication → URL Configuration** → set the Site URL to your app URL and
   add `https://your-app.vercel.app/auth/callback` to the redirect allow-list.
   Add `http://localhost:3000/auth/callback` too while you develop.
6. **Project Settings → API** → copy the project URL, the anon key, and the
   service role key.

Signup is email and password, straight through. There are no magic links.

## 2. The encryption key

This is what protects your customers' API keys.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save it as `SECRETS_ENCRYPTION_KEY`. **Rotating it later makes every stored
customer key unreadable** and they will all have to re-enter them, so put it
somewhere you will not lose it.

## 3. Dodo Payments

1. Create three **recurring monthly** products: $29/mo, $59/mo and $149/mo.
   Copy all three product ids. (One-time products will check out but never renew, and the
   subscription webhooks that grant and revoke access will never fire.)
2. **Developer → API Keys** → create a key.
3. **Developer → Webhooks** → add an endpoint:

   ```
   https://your-app.vercel.app/api/webhooks/dodo
   ```

   Subscribe it to the subscription lifecycle, not just payments:
   `subscription.active`, `subscription.renewed`, `subscription.cancelled`,
   `subscription.expired`, `subscription.failed`, `subscription.on_hold`, and
   `payment.succeeded`. Copy the signing secret — it starts with `whsec_`.

   Access is granted **and revoked** by these events. Subscribe to only the
   grant half and customers keep their agents forever after cancelling.

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

Everything in that file is documented inline. The optional ones are
`GEMINI_API_KEY` (the support widget), `DEMO_OPENAI_API_KEY` (a fallback for
the Custom Agent Builder) and `VERCEL_TEAM_ID`.

## 6. Run it

```bash
npm install
npm run dev
```

- Landing page: <http://localhost:3000>
- Sign up, answer the four onboarding questions, and the dashboard opens. You
  can browse all 25 agents and configure them without paying — the paywall
  appears when you click Deploy.

To skip the paywall locally, run this in the Supabase SQL editor after signing
up once:

```sql
update agentstack.profiles
set plan = 'pro', agent_quota = 10
where email = 'you@example.com';
```

(`pro` also unlocks the Custom Agent Builder. Use `starter` / `3` to see what a
Starter customer sees, or `unlimited` / `999` for no cap.)

## 7. Deploy the SaaS

Import the repo into Vercel and set one thing:

> **Settings → Build and Deployment → Root Directory: `apps/web`**

That is the whole configuration. Vercel then detects Next.js, installs
`apps/web`'s dependencies, runs `next build`, and finds the output at
`apps/web/.next`. Leave the build and install commands empty — the defaults are
correct, and overriding them is what causes the two failures below.

This repo deliberately ships **no `vercel.json` at the root**. With a Root
Directory set, Vercel still reads a repo-root `vercel.json`, but runs its
commands inside the Root Directory — so a root-relative build command breaks:

```
npm error No workspaces found: --workspace=apps/web
```

(`apps/web/package.json` has no `workspaces` field; only the repo root does.)

And leaving Root Directory at the repository root fails the other way, because
the build writes to `apps/web/.next` while Vercel looks in `./.next`:

```
Error: The Next.js output directory ".next" was not found at "/vercel/path0/.next"
```

Root Directory `apps/web`, no overrides. That configuration is verified.

The build still reaches `apps/hermes-core` from there — Vercel clones the whole
repository and only changes the working directory, so the `prebuild` step that
bundles the agent engine works normally.

Add every variable from `.env.example` to the project's environment, and set
`NEXT_PUBLIC_APP_URL` to the real production URL.

Do not create a Vercel project for `apps/hermes-core`. It is not a site you
host — it is the payload the deploy pipeline uploads, one copy per customer
agent.

Once it is live, **`/setup` is the page to open first**. It renders even when
nothing else works — it constructs no Supabase client and touches no database —
and it lists exactly which environment variables are missing plus the database
step. If sign-in is broken, that page will say why.

Then check the wiring:

```bash
curl -s https://your-app.vercel.app/api/health | jq
```

It lists exactly which environment variables are missing and whether the
schema has been created. It returns 503 until everything is in place.

## 8. Start the clock

**Nothing your agents do on a schedule happens until the clock is running.** The
briefing, the research pulse, "at 5pm write the launch post", and the squads
doing today's work are all endpoints that wait to be called. Without a clock the
product looks alive — agents deploy, chat answers, the dashboard renders — and
never does a single thing on its own.

One endpoint drives all of it: `/api/cron/heartbeat`. Call it every few minutes
and it works out which workers are overdue and runs them. You never schedule the
individual jobs, and nothing here changes when a cadence changes later.

### The easy way: the scheduler inside your database (recommended)

Postgres can call a URL on a schedule by itself, and you already have a Postgres.
`0017_internal_scheduler.sql` — included in `schema.sql`, so it ran in step 1 —
sets up pg_cron and pg_net and generates its own bearer token. There is nothing
to keep in sync with an environment variable, because the app reads the same row
the scheduler signs with.

One field to fill in. In the Supabase SQL editor:

```sql
update agentstack.scheduler_config
   set app_url = 'https://your-app.vercel.app'
 where id;
```

Then confirm it is beating (wait five minutes, or run `select agentstack.beat();`
to fire one now):

```sql
select app_url, last_beat_at from agentstack.scheduler_config;
select jobname, schedule, active from cron.job where jobname = 'agentstack-heartbeat';
```

`last_beat_at` filling in means the clock is running. If the migration warned
that it could not schedule the job, enable **pg_cron** under Database →
Extensions in the Supabase dashboard and run `0017_internal_scheduler.sql` again.

### Or drive it from outside

Either of these works instead of — or alongside — the database scheduler. Both
tokens are accepted, and a worker that already ran this interval is skipped
rather than run twice, so there is no conflict in having both.

First get the token an outside scheduler needs:

```bash
SECRETS_ENCRYPTION_KEY=<the same value you set in Vercel> npm run cron:secret
```

The app derives its cron token from `SECRETS_ENCRYPTION_KEY` when `CRON_SECRET`
is unset, so there is nothing extra to generate. Set `CRON_SECRET` in Vercel
explicitly if you would rather rotate it on its own — then that value wins, and
the command above prints it back to you.

Then pick one of these. Either is enough; both together is fine, because a
worker that has already run this interval is skipped rather than run twice.

**GitHub Actions — free, every five minutes.** `.github/workflows/heartbeat.yml`
is already in the repo. Give it two things in your repository settings:

- Settings → Secrets and variables → Actions → **Secrets** → `CRON_SECRET`, the
  value printed above.
- Same page → **Variables** → `APP_URL`, your deployment URL with no trailing
  slash.

Until both exist the workflow skips with a notice instead of failing, so an
unconfigured fork does not email you every five minutes forever.

**Vercel Cron — Pro only.** This repo ships no `crons` block, on purpose: Hobby
rejects any schedule more frequent than once a day, so a five-minute entry fails
the deploy outright, and a once-a-day entry cannot run a 5pm task or a morning
briefing. If you are on Pro and want Vercel to drive it, add this to
`apps/web/vercel.json` and set `CRON_SECRET` in the project — Vercel signs the
call with it:

```json
{ "crons": [{ "path": "/api/cron/heartbeat", "schedule": "*/5 * * * *" }] }
```

On Hobby, use the database scheduler above. It has no such limit.

Confirm it works:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/heartbeat?force=1" | jq
```

`force=1` ignores the cadences and runs every worker now, which is how you prove
the wiring on the day you deploy rather than waiting fifteen minutes to find out
it is wrong. Without it you will see workers move between `dispatched` and
`skipped` as their intervals come round — that is the schedule working.

A `401` means the token here and the one in Vercel have drifted apart. A `500`
about `NEXT_PUBLIC_APP_URL` means the heartbeat cannot find its own workers —
set it to the production URL and redeploy.

## 9. The support agent (optional)

The floating helper in the dashboard runs on Gemini. Get a key from
[aistudio.google.com](https://aistudio.google.com/apikey) and set
`GEMINI_API_KEY`. It is the platform's key, not the customer's — this is a
support cost, and someone who is stuck should not have to configure anything to
get unstuck. Leave it blank and the widget says it is switched off.

## 10. Before you take real money

- [ ] Switch `DODO_ENVIRONMENT` to `live` and swap in the live product ids.
- [ ] Send a test webhook from Dodo and confirm the plan lands on the profile.
- [ ] Set `NEXT_PUBLIC_TWITTER_HANDLE`, `NEXT_PUBLIC_FOUNDER_NAME` and
      `NEXT_PUBLIC_SUPPORT_EMAIL` — the footer and the refund promise reference them.
- [ ] Put real quotes in `apps/web/src/lib/testimonials.ts`. The section stays
      hidden while it is empty, which is the correct behaviour, but a launch
      with no proof converts badly. Get five users first.
- [ ] Read `docs/SECURITY.md` and confirm the service role key is not in any
      `NEXT_PUBLIC_` variable.
- [ ] Hit `/api/cron/heartbeat?force=1` and confirm it answers 200. If the clock
      is not running, every scheduled promise on the landing page is false.
- [ ] Message your bot `diagnose` on Telegram. It answers with every blocker
      between you and working agents — a stopped clock, a missing model key, a
      lapsed trial, a rejected connector key — and what to do about each.
