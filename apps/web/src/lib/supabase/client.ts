"use client";

import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA } from "./schema";

/**
 * Browser client. Publishable key only — it can never read agent_secrets.
 *
 * The env vars are checked rather than asserted with `!`. Asserting turned a
 * missing key into a thrown constructor on the login page, which is the exact
 * page someone needs when the app is misconfigured.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseNotConfiguredError();
  }
  return createBrowserClient(url, anonKey, { db: { schema: DB_SCHEMA } });
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Sign-in is not available yet — this deployment is missing its Supabase keys.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}
