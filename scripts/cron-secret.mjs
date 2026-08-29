#!/usr/bin/env node
/**
 * Prints the bearer token the heartbeat expects.
 *
 * The app derives its cron secret from SECRETS_ENCRYPTION_KEY when CRON_SECRET
 * is unset, so that a fresh deploy schedules itself with nothing to configure.
 * That convenience has one sharp edge: an *outside* scheduler cannot guess the
 * derived value, and the last time this was wired up the workflow failed every
 * five minutes for weeks because nobody knew what to paste.
 *
 * So this prints it. Run it with the same SECRETS_ENCRYPTION_KEY the deployment
 * uses, and paste the result into the CRON_SECRET repository secret.
 *
 *   SECRETS_ENCRYPTION_KEY=... npm run cron:secret
 */
import { createHmac } from "node:crypto";

const explicit = process.env.CRON_SECRET?.trim();
if (explicit) {
  console.log(explicit);
  console.error("\n(CRON_SECRET is set explicitly — this is the value to use.)");
  process.exit(0);
}

const base = process.env.SECRETS_ENCRYPTION_KEY?.trim();
if (!base) {
  console.error("Set SECRETS_ENCRYPTION_KEY (or CRON_SECRET) and run this again.");
  console.error("Both live in your Vercel project's environment variables.");
  process.exit(1);
}

// Must stay identical to cronSecret() in apps/web/src/lib/cron-auth.ts.
console.log(createHmac("sha256", base).update("agentstack-cron-v1").digest("hex"));
console.error("\nPaste that into the CRON_SECRET repository secret on GitHub,");
console.error("and set the APP_URL repository variable to your deployment URL.");
