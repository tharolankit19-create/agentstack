import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import { openSecrets, sealSecrets } from "@/lib/crypto";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pushes the shared setup onto every agent that can use it.
 *
 * The website, the ICP and the competitor list are the same facts for all
 * fourteen agents, and asking fourteen times is how a setup flow becomes an
 * abandonment funnel.
 *
 * The important detail is that it writes a key onto an agent **only if that
 * agent's template actually declares it**. Settings become `SETTING_*`
 * environment variables at deploy time, so writing arbitrary keys onto every
 * agent would ship each deployment a pile of variables its prompts never
 * reference — noise in the environment and, worse, a config object that no
 * longer matches the form the customer sees on that agent's page.
 *
 * Existing values win. Someone who has already tuned an agent by hand should
 * not have it flattened by a bulk form they filled in afterwards.
 */

const bodySchema = z.object({
  websiteUrl: z.string().max(300).optional(),
  linkedinUrl: z.string().max(300).optional(),
  twitterHandle: z.string().max(120).optional(),
  icp: z.string().max(2_000).optional(),
  competitors: z.string().max(4_000).optional(),
  /**
   * One model key, for every agent.
   *
   * Every template in the catalog declares `OPENAI_API_KEY` and every one of
   * them means the same thing by it: an OpenAI-compatible endpoint the founder
   * pays for directly. Asking fourteen times for the same string is the single
   * most avoidable way to lose someone during setup.
   */
  modelKey: z.string().max(500).optional(),
});

/**
 * The one credential every agent needs.
 *
 * Named for OpenAI because that is the API shape, not the vendor: OpenRouter,
 * Groq, Together and NVIDIA NIM all speak it, and the founder picks whichever
 * they want to be billed by.
 */
const MODEL_KEY = "OPENAI_API_KEY";

/**
 * One answer can satisfy several differently-named settings.
 *
 * Templates were written independently and call the same thing `websiteUrl`,
 * `siteUrl` or `url`. Rather than renaming settings across the catalog — which
 * would orphan the config of every already-deployed agent — the shared form
 * maps one answer onto whichever alias each template declares.
 */
const ALIASES: Record<SettingField, string[]> = {
  websiteUrl: ["websiteUrl", "siteUrl", "url", "homepageUrl", "docsUrl"],
  linkedinUrl: ["linkedinUrl", "profileUrl", "linkedin"],
  twitterHandle: ["twitterHandle", "handle", "xHandle"],
  icp: ["icp", "audience", "targetAudience", "customer", "persona"],
  competitors: ["competitors", "competitorUrls", "sources", "watchList"],
};

export async function POST(request: Request) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing usable in that." }, { status: 400 });
  }

  // The model key is a credential, not a setting. It takes a different path
  // below — encrypted into agent_secrets rather than written to a config
  // column that the settings form renders in plain text.
  const { modelKey, ...settingFields } = parsed.data;

  const answers = Object.entries(settingFields).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  ) as [SettingField, string][];

  if (answers.length === 0 && !modelKey?.trim()) {
    return NextResponse.json({ updated: 0, keyed: 0 });
  }

  const admin = createAdminClient();
  const { data: agents } = await admin
    .from("agents")
    .select("id, user_id, template_id, config, secret_keys")
    .eq("user_id", auth.session.userId);

  let updated = 0;
  let keyed = 0;

  for (const agent of (agents ?? []) as Pick<
    Agent,
    "id" | "user_id" | "template_id" | "config" | "secret_keys"
  >[]) {
    const template = getTemplate(agent.template_id);
    if (!template) continue;

    const declared = new Set(template.settings.map((setting) => setting.key));
    const config: Record<string, unknown> = { ...(agent.config ?? {}) };
    let changed = false;

    for (const [field, value] of answers) {
      for (const alias of ALIASES[field]) {
        // Only keys this template declares, and never overwrite a real answer.
        if (!declared.has(alias)) continue;
        if (config[alias]) continue;
        config[alias] = value.trim();
        changed = true;
      }
    }

    if (changed) {
      await admin.from("agents").update({ config }).eq("id", agent.id);
      updated += 1;
    }

    if (await applyModelKey(admin, agent, template, modelKey)) keyed += 1;
  }

  return NextResponse.json({ updated, keyed });
}

type SettingField = Exclude<keyof z.infer<typeof bodySchema>, "modelKey">;

/**
 * Puts one model key on one agent.
 *
 * Merged into whatever that agent already holds rather than replacing the
 * envelope, because an agent may already have keys nothing here knows about —
 * an Apollo key, a Resend key — and a bulk setup form is not entitled to wipe
 * them. Existing values win for the same reason: someone who pasted a
 * different key on one agent's own page meant it.
 *
 * Returns whether it wrote anything, so the response can say how far it got.
 */
async function applyModelKey(
  admin: ReturnType<typeof createAdminClient>,
  agent: Pick<Agent, "id" | "user_id" | "template_id" | "secret_keys">,
  template: { secrets: { key: string }[] },
  modelKey: string | undefined,
): Promise<boolean> {
  const key = modelKey?.trim();
  if (!key) return false;
  if (!template.secrets.some((spec) => spec.key === MODEL_KEY)) return false;
  if (agent.secret_keys?.includes(MODEL_KEY)) return false;

  const { data: row } = await admin
    .from("agent_secrets")
    .select("ciphertext")
    .eq("agent_id", agent.id)
    .maybeSingle<{ ciphertext: string }>();

  let existing: Record<string, string> = {};
  if (row?.ciphertext) {
    try {
      existing = openSecrets(row.ciphertext);
    } catch {
      // An envelope we cannot open is one we must not overwrite blindly, but
      // it is also unusable — starting a fresh one is the only way forward,
      // and the customer's other keys were already unreadable.
      existing = {};
    }
  }

  if (existing[MODEL_KEY]) return false;

  const { error } = await admin.from("agent_secrets").upsert(
    {
      agent_id: agent.id,
      user_id: agent.user_id,
      ciphertext: sealSecrets({ ...existing, [MODEL_KEY]: key }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agent_id" },
  );

  if (error) return false;

  await admin
    .from("agents")
    .update({
      secret_keys: [...new Set([...(agent.secret_keys ?? []), MODEL_KEY])],
      status: "configured",
    })
    .eq("id", agent.id);

  return true;
}
