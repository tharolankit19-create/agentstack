import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { openSecrets, sealSecrets } from "@/lib/crypto";
import { getTemplate } from "@/lib/templates";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Change the one model key, across the whole army.
 *
 * The founder brings their own model key and every agent runs on it. When that
 * key rotates — a new provider, a leaked key revoked, a free OpenRouter key
 * swapped for a paid one — they need one place to change it once rather than
 * opening fourteen agent pages. This is that place.
 *
 * Unlike the setup form, which fills gaps and never overwrites, this
 * *replaces*: the whole point of a re-key is that the old value is wrong.
 * Agents keep every other secret they hold — an Apollo key, a Resend key —
 * because those are re-sealed alongside, not dropped.
 *
 * The new key is re-validated only in shape here, not against the provider:
 * there are too many OpenAI-compatible endpoints to test against, and the
 * first real run surfaces a bad key with the provider's own message.
 */

const MODEL_KEY = "OPENAI_API_KEY";

const bodySchema = z.object({
  key: z.string().trim().min(10).max(500),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`modelkey:${auth.session.userId}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Give it a moment before trying again." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paste the whole key — it looks too short." },
      { status: 400 },
    );
  }
  const key = parsed.data.key;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("agents")
    .select("id, user_id, template_id, secret_keys")
    .eq("user_id", auth.session.userId);

  const agents = (rows ?? []) as Pick<
    Agent,
    "id" | "user_id" | "template_id" | "secret_keys"
  >[];

  let updated = 0;

  for (const agent of agents) {
    // Every catalog template declares OPENAI_API_KEY, but guard anyway so a
    // future keyless template is not handed a variable it never reads.
    const template = getTemplate(agent.template_id);
    if (template && !template.secrets.some((s) => s.key === MODEL_KEY)) continue;

    const { data: secretRow } = await admin
      .from("agent_secrets")
      .select("ciphertext")
      .eq("agent_id", agent.id)
      .maybeSingle<{ ciphertext: string }>();

    let existing: Record<string, string> = {};
    if (secretRow?.ciphertext) {
      try {
        existing = openSecrets(secretRow.ciphertext);
      } catch {
        existing = {};
      }
    }

    const { error } = await admin.from("agent_secrets").upsert(
      {
        agent_id: agent.id,
        user_id: agent.user_id,
        ciphertext: sealSecrets({ ...existing, [MODEL_KEY]: key }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" },
    );
    if (error) continue;

    await admin
      .from("agents")
      .update({
        secret_keys: [...new Set([...(agent.secret_keys ?? []), MODEL_KEY])],
      })
      .eq("id", agent.id);

    updated += 1;
  }

  return NextResponse.json({
    updated,
    message:
      updated === 0
        ? "No agents to update yet — set up your army first and this key goes to all of them."
        : `New key saved to ${updated} ${updated === 1 ? "agent" : "agents"}. Redeploy them to pick it up.`,
  });
}

/** Whether a model key is on file, without ever returning it. */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("agents")
    .select("secret_keys")
    .eq("user_id", auth.session.userId);

  const anyKeyed = ((rows ?? []) as Pick<Agent, "secret_keys">[]).some((row) =>
    (row.secret_keys ?? []).includes(MODEL_KEY),
  );

  return NextResponse.json({ configured: anyKeyed });
}
