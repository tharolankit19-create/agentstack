import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runtimeBundleInfo } from "@/lib/deploy";
import { PLANS } from "@/lib/plans";
import { TEMPLATES } from "@/lib/templates";

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
    vercelApiToken: Boolean(process.env.VERCEL_API_TOKEN),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
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
  ];
  const missing = required.filter((key) => !env[key]);

  const database = await checkDatabase();

  const ready = missing.length === 0 && database.ok;

  return NextResponse.json(
    {
      status: ready ? "ready" : "misconfigured",
      missingEnv: missing,
      env,
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
          error: "Run supabase/migrations/0001_init.sql in the SQL editor.",
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
