import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
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
});

/**
 * One answer can satisfy several differently-named settings.
 *
 * Templates were written independently and call the same thing `websiteUrl`,
 * `siteUrl` or `url`. Rather than renaming settings across the catalog — which
 * would orphan the config of every already-deployed agent — the shared form
 * maps one answer onto whichever alias each template declares.
 */
const ALIASES: Record<keyof z.infer<typeof bodySchema>, string[]> = {
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

  const answers = Object.entries(parsed.data).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  ) as [keyof z.infer<typeof bodySchema>, string][];

  if (answers.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const admin = createAdminClient();
  const { data: agents } = await admin
    .from("agents")
    .select("id, template_id, config")
    .eq("user_id", auth.session.userId);

  let updated = 0;

  for (const agent of (agents ?? []) as Pick<
    Agent,
    "id" | "template_id" | "config"
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

    if (!changed) continue;

    await admin.from("agents").update({ config }).eq("id", agent.id);
    updated += 1;
  }

  return NextResponse.json({ updated });
}
