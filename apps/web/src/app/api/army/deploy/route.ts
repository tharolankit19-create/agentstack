import { NextResponse } from "next/server";
import { requirePaidApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rosterTemplateIds } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { quotaFor } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Create the whole army in one click.
 *
 * Setting up fourteen agents one card at a time is the reason people stop at
 * two. This creates every roster agent the customer does not already have, in
 * roster order, so the head agent exists before the squads that report to it.
 *
 * **It creates, it does not deploy.** Every agent needs settings the customer
 * has to supply — their website, their competitors, their model key — and
 * pushing empty agents to Vercel would produce fourteen deployments that all
 * fail on their first run. So this gets them onto the board in `draft`, and
 * the onboarding step fills in the shared fields for all of them at once.
 *
 * Partial success is a real outcome and is reported as one. The quota trigger
 * can refuse partway through — that is it working correctly — and the response
 * says exactly how far it got rather than throwing away the agents it did
 * create.
 */
export async function POST() {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`army:${auth.session.userId}`, 6, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Give the last one a moment to finish." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  const { data: existingRows } = await admin
    .from("agents")
    .select("template_id")
    .eq("user_id", auth.session.userId);

  const existing = new Set(
    ((existingRows ?? []) as Pick<Agent, "template_id">[]).map((row) => row.template_id),
  );

  const quota = quotaFor(auth.session.profile);
  const room = Math.max(quota - existing.size, 0);

  const wanted = rosterTemplateIds().filter((id) => !existing.has(id));

  if (wanted.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: existing.size,
      message: "Your whole army already exists.",
    });
  }

  if (room === 0) {
    return NextResponse.json(
      {
        error: `Your plan runs ${quota} agents and you already have ${existing.size}. Upgrade to add the rest.`,
        code: "quota_reached",
      },
      { status: 409 },
    );
  }

  const created: string[] = [];
  const failed: { templateId: string; reason: string }[] = [];

  // Sequential, not parallel: the quota trigger counts rows, and fourteen
  // concurrent inserts would race past a limit that a serial loop respects.
  for (const templateId of wanted.slice(0, room)) {
    const template = getTemplate(templateId);
    if (!template) continue;

    const { error } = await admin.from("agents").insert({
      user_id: auth.session.userId,
      template_id: templateId,
      name: template.name,
      config: {},
    });

    if (error) {
      failed.push({ templateId, reason: error.message });
      // A quota refusal means every remaining insert fails the same way.
      if (error.message.toLowerCase().includes("limit")) break;
      continue;
    }
    created.push(templateId);
  }

  return NextResponse.json({
    created: created.length,
    createdIds: created,
    skipped: existing.size,
    remaining: Math.max(wanted.length - created.length, 0),
    failed,
    message:
      created.length === wanted.length
        ? `Your army is on the board — ${created.length} agents. Add your details and they start working.`
        : `Created ${created.length} of ${wanted.length}. ${
            failed[0]?.reason ?? "The rest need a bigger plan."
          }`,
  });
}
