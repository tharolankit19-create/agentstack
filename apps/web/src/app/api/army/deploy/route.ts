import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEAD_AGENT, rosterTemplateIds, memberFor } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { quotaFor } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Enlist the army, head agent first.
 *
 * The founder answers one form about their head agent — what to call it and
 * when it should message them — and everything else is created behind it in
 * roster order. That ordering is not cosmetic: the head agent is the only one
 * the founder ever talks to, and a dashboard that hands someone thirteen
 * workers and no commander is thirteen things to configure with no reason to.
 *
 * **It creates, it does not deploy.** Every agent needs settings the customer
 * has to supply — their website, their competitors, their model key — and
 * pushing empty agents to Vercel would produce fourteen deployments that all
 * fail on their first run. So this gets them onto the board in `draft`, and
 * the shared config below fills in what all of them need at once.
 *
 * Partial success is a real outcome and is reported as one. The quota trigger
 * can refuse partway through — that is it working correctly — and the response
 * says exactly how far it got rather than throwing away the agents it did
 * create.
 */

const bodySchema = z
  .object({
    /** What the founder decided to call their head agent. */
    headName: z.string().trim().min(1).max(40).optional(),
    /** Its schedule. Written onto the head agent only. */
    headConfig: z.record(z.string(), z.string().max(500)).optional(),
  })
  .nullable();

export async function POST(request: Request) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`army:${auth.session.userId}`, 6, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Give the last one a moment to finish." },
      { status: 429 },
    );
  }

  // A body is optional — the button on an already-half-built account posts
  // nothing and just fills the gaps.
  const parsed = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  const headName = parsed.success ? parsed.data?.headName : undefined;
  const headConfig = parsed.success ? parsed.data?.headConfig : undefined;

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

  // Renaming the commander is worth doing even when it already exists —
  // otherwise someone who deployed yesterday can never change its name here.
  if (existing.has(HEAD_AGENT.id) && (headName || headConfig)) {
    const { data: head } = await admin
      .from("agents")
      .select("id, config")
      .eq("user_id", auth.session.userId)
      .eq("template_id", HEAD_AGENT.id)
      .maybeSingle();

    if (head) {
      await admin
        .from("agents")
        .update({
          ...(headName ? { name: headName } : {}),
          ...(headConfig
            ? { config: { ...((head as { config?: object }).config ?? {}), ...headConfig } }
            : {}),
        })
        .eq("id", (head as { id: string }).id);
    }
  }

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
  // The roster is already head-agent-first, so a plan that only has room for
  // some of them gets the commander and the top of the list, never the
  // reverse.
  for (const templateId of wanted.slice(0, room)) {
    const template = getTemplate(templateId);
    if (!template) continue;

    const isHead = templateId === HEAD_AGENT.id;

    const { error } = await admin.from("agents").insert({
      user_id: auth.session.userId,
      template_id: templateId,
      // Its name, not its job title. "Otis drafted five posts" is a colleague;
      // "Content Agent drafted five posts" is a cron job with a log line.
      name:
        (isHead ? headName : undefined) ??
        memberFor(templateId)?.name ??
        template.name,
      config: isHead && headConfig ? headConfig : {},
    });

    if (error) {
      failed.push({ templateId, reason: error.message });
      // A quota refusal means every remaining insert fails the same way.
      if (error.message.toLowerCase().includes("limit")) break;
      continue;
    }
    created.push(templateId);
  }

  const commander = headName ?? HEAD_AGENT.defaultName;

  return NextResponse.json({
    created: created.length,
    createdIds: created,
    skipped: existing.size,
    remaining: Math.max(wanted.length - created.length, 0),
    failed,
    message:
      created.length === wanted.length
        ? `${commander} is in command, with ${created.length - 1} agents reporting.`
        : `Created ${created.length} of ${wanted.length}. ${
            failed[0]?.reason ?? "The rest need a bigger plan."
          }`,
  });
}
