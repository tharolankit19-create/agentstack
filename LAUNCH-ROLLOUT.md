# AgentStack launch rollout

This change targets 13 launch agents: one head plus research, analytics,
content, landing, SEO, blog, ads, newsletter, competitor, community, lead,
and outreach specialists. Existing other agents and templates are retained.

## Apply before merging

1. Apply `supabase/migrations/0021_workspace_trial_and_tasks.sql` to the
   existing Supabase database, after migrations 0001–0020. It permits free
   draft setup, fixes agent quotas, adds the running task state, and preserves
   existing user data. The migration assumes the `agentstack` schema.
2. Configure real monthly Dodo products at $49 and $99. Set their IDs as
   `NEXT_PUBLIC_DODO_PRODUCT_STARTER_49` and
   `NEXT_PUBLIC_DODO_PRODUCT_PRO_99` in Vercel. Keep the old product IDs for
   existing subscription webhook recognition. The code intentionally does
   not reuse a $29/$59 product for a $49/$99 checkout.
3. Verify `OPENROUTER_API_KEY`, `MONID_API_KEY`, `FIRECRAWL_API_KEY`, Supabase
   URL/anon/service-role values, and `SECRETS_ENCRYPTION_KEY` in Vercel.
   Keys are never placed in the browser or this document.
4. Set `NEXT_PUBLIC_APP_URL` to the live app origin. The GitHub Actions
   `APP_URL` repository variable must use the same origin. Its `CRON_SECRET`
   repository secret must match Vercel's `CRON_SECRET`.
5. For Telegram delivery, set `TELEGRAM_BOT_TOKEN`, register the webhook using
   the existing Telegram setup action, and connect the founder's chat through
   the dashboard. A saved API token alone is not a linked Telegram recipient.

## After deployment

- On the dashboard, use **Start my army** to fill missing launch roles and
  activate the built-in roster. The operation does not create Vercel projects.
- Send a lead search. Verify the user message survives refresh, real source
  activity appears, results reach Leads, and the generated output opens from
  Mission Control. Failed providers must report the failure without fake leads.
- Approve a draft; verify its saved approval and Done status. Approval does
  not automatically publish externally.
- In the room, type `@`, filter a name, select it with keyboard or touch,
  and verify both the room message and the agent chat survive refresh.
- Schedule a short task and run the Heartbeat workflow. Check running → done
  or failed, and open the result from the task card.
- Check the morning slot in the founder's timezone and Telegram delivery.
  Late ticks now catch up; saved undelivered briefings retry delivery.
- With a new account, verify free observation/setup, the trial modal on a
  work action, both 72-hour trial choices, and locked work after expiry.

## Verified locally

`npm run build` compiles and type-checks the application.
`node scripts/verify-launch.cjs` checks the 13-role roster, price choices,
entitlement and expiry, India morning boundaries, mention resolution, and
database failure handling for room persistence.

Live provider credentials, database migration execution, authenticated browser
flows, actual Telegram receipt, and paid checkout were not available to test
in this workspace. A successful build is not evidence of those integrations.
