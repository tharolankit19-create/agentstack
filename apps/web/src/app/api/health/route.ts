import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, runtimeBundleInfo } from "@/lib/deploy";
import { PLANS } from "@/lib/plans";
import { TEMPLATES } from "@/lib/templates";
import { botIdentity, webhookInfo } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Is production actually configured?"
 *
 * Reports which environment variables are present and whether the database
 * answers. It reports names and booleans only — never a value, never a
 * fragment of one — so it is safe to leave public and hit from a phone after
 * a deploy.
 */
export async function GET() {
  const env = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    secretsEncryptionKey: Boolean(process.env.SECRETS_ENCRYPTION_KEY),
    dodoApiKey: Boolean(process.env.DODO_PAYMENTS_API_KEY),
    dodoWebhookSecret: Boolean(process.env.DODO_WEBHOOK_SECRET),
    dodoProductStarter: Boolean(PLANS.starter.productId),
    dodoProductPro: Boolean(PLANS.pro.productId),
    dodoProductUnlimited: Boolean(PLANS.unlimited.productId),
    vercelApiToken: Boolean(process.env.VERCEL_API_TOKEN),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    cronSecret: Boolean(process.env.CRON_SECRET),
    demoOpenAiKey: Boolean(
      process.env.DEMO_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    ),
  };

  // Everything the product cannot function without. The demo key is optional.
  const required: (keyof typeof env)[] = [
    "supabaseUrl",
    "supabaseAnonKey",
    "supabaseServiceRoleKey",
    "secretsEncryptionKey",
    "dodoApiKey",
    "dodoWebhookSecret",
    "dodoProductStarter",
    "dodoProductPro",
    "vercelApiToken",
    "appUrl",
    // The head agent's whole promise is that it messages you. Without these
    // two the product deploys, runs, produces work, and tells nobody.
    "telegramBotToken",
    "telegramWebhookSecret",
  ];
  const missing = required.filter((key) => !env[key]);

  const database = await checkDatabase();
  const telegram = await checkTelegram();

  // Telegram is reported but does not gate "ready": a bot with an
  // unregistered webhook is one POST away from working, and a red health check
  // that cannot distinguish that from a missing database helps nobody.
  const ready = missing.length === 0 && database.ok;

  return NextResponse.json(
    {
      status: ready ? "ready" : "misconfigured",
      missingEnv: missing,
      env,
      telegram,
      // The one value worth echoing back. It is a public URL, so there is
      // nothing to leak, and it is the only setting whose *content* can be
      // wrong in a way booleans cannot show — a hostname pasted without a
      // scheme resolves fine here but would silently point every canonical
      // and Open Graph URL at the wrong place if it did not.
      resolvedAppUrl: appUrl(),
      database,
      dodoEnvironment: process.env.DODO_ENVIRONMENT ?? "test",
      templates: TEMPLATES.map((template) => template.id),
      agentBundle: runtimeBundleInfo(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}

async function checkDatabase(): Promise<{
  ok: boolean;
  migrated: boolean;
  error?: string;
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { ok: false, migrated: false, error: "Supabase is not configured." };
  }

  try {
    const admin = createAdminClient();
    // A real GET, not a HEAD. `head: true` sends no response body, so
    // PostgREST's error payload never arrives and a missing table reads as
    // success — a health check that lies is worse than no health check.
    const { error } = await admin.from("profiles").select("id").limit(1);

    if (error) {
      // PGRST205 is "table not in the schema cache" — the migration never ran.
      const notMigrated = error.code === "PGRST205" || error.code === "42P01";
      if (notMigrated) {
        return {
          ok: false,
          migrated: false,
          error: "Paste supabase/schema.sql into the Supabase SQL editor and run it.",
        };
      }
      return {
        ok: false,
        migrated: true,
        // Supabase returns an empty message for a rejected key, which is the
        // single most likely misconfiguration — so name it rather than
        // reporting a blank error.
        error:
          error.message ||
          `Supabase rejected the request${error.code ? ` (${error.code})` : ""}. ` +
            "Check SUPABASE_SERVICE_ROLE_KEY.",
      };
    }
    return { ok: true, migrated: true };
  } catch (cause) {
    return {
      ok: false,
      migrated: false,
      error: cause instanceof Error ? cause.message : "Database unreachable.",
    };
  }
}

/**
 * Is the bot actually wired up?
 *
 * Reported separately from the environment booleans because the failure that
 * matters here is not a missing variable — it is a token that is present and a
 * webhook that was never registered, which produces a bot that receives every
 * message and forwards none of them. That state looks identical to a broken
 * bot from the outside, and it was the reason the first one never replied.
 *
 * Names and booleans only, like everything else on this endpoint. The webhook
 * URL is public, the token is never touched.
 */
async function checkTelegram(): Promise<{
  ok: boolean;
  bot: string | null;
  webhookRegistered: boolean;
  webhookMatches: boolean;
  lastError: string | null;
  fix: string | null;
}> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return {
      ok: false,
      bot: null,
      webhookRegistered: false,
      webhookMatches: false,
      lastError: null,
      fix: "Set TELEGRAM_BOT_TOKEN.",
    };
  }

  const me = await botIdentity();
  const info = await webhookInfo();
  const registered = info.result?.url ?? "";

  const base = appUrl();
  const expected = base ? `${base.replace(/\/+$/, "")}/api/telegram/webhook` : null;
  const matches = Boolean(expected && registered === expected);

  const fix = !me
    ? "Telegram does not recognise TELEGRAM_BOT_TOKEN — re-copy it from @BotFather."
    : !process.env.TELEGRAM_WEBHOOK_SECRET
      ? "Set TELEGRAM_WEBHOOK_SECRET, then POST /api/telegram/setup."
      : !registered
        ? "No webhook registered. POST /api/telegram/setup as an admin."
        : !matches
          ? `Another service owns this bot's webhook (${registered}). A bot can only have one, so no message reaches us. Remove the bot from that service, or use a separate bot here, then POST /api/telegram/setup.`
          : null;

  return {
    ok: Boolean(me) && matches && !info.result?.last_error_message,
    bot: me?.username ?? null,
    webhookRegistered: Boolean(registered),
    webhookMatches: matches,
    lastError: info.result?.last_error_message ?? null,
    fix,
  };
}
