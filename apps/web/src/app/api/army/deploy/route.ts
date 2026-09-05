import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEAD_AGENT } from "@/lib/army";
import { enlistArmy } from "@/lib/enlist";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Fill in whatever is missing from the army, and rename the commander.
 *
 * This used to be the only way an account got agents at all, and it carried a
 * long comment explaining why it created them in `draft` rather than deploying
 * anything: every agent needed a model key and a website the founder had not
 * supplied yet. Both halves of that are now wrong. We host the agents and we
 * hold the keys, so there is nothing to push anywhere, and the roster is
 * created the moment the account is — in `lib/enlist.ts`, called from the auth
 * callback and from the dashboard layout.
 *
 * What is left for this route is the case enlistment deliberately refuses: an
 * account that already has *some* agents and wants the rest back. That is an
 * explicit request, so it passes `full: true`, and it is the only caller that
 * does.
 *
 * It also renames the head agent, which is worth doing even when nothing is
 * created — otherwise a founder who signed up yesterday could never change
 * what their commander is called from here.
 */

const bodySchema = z
  .object({
    /** What the founder decided to call their head agent. */
    headName: z.string().trim().min(1).max(40).optional(),
    /** Its schedule and business context. Every other agent inherits these. */
    headConfig: z.record(z.string(), z.string().max(500)).optional(),
  })
  .nullable();

export async function POST(request: Request) {
  // Deliberately `requireUser`, not `requireOperatorApiUser`. Under credits,
  // holding agents is free and running them is what costs — so the gate that
  // matters is on the run, not on the roster. Refusing here would leave a
  // founder whose balance hit zero staring at an empty dashboard instead of a
  // paused one.
  const session = await requireUser();

  const limit = rateLimit(`army:${session.userId}`, 6, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Give the last one a moment to finish." },
      { status: 429 },
    );
  }

  // A body is optional — the button on a half-built account posts nothing and
  // just fills the gaps.
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const headName = parsed.success ? parsed.data?.headName : undefined;
  const headConfig = parsed.success ? parsed.data?.headConfig : undefined;

  const admin = createAdminClient();

  const result = await enlistArmy(admin, session.userId, {
    headName,
    headConfig,
    full: true,
  });

  // Renaming is separate from creating, because the head agent usually already
  // exists by the time anyone presses this.
  if ((headName || headConfig) && result.existing > 0) {
    const { data: head } = await admin
      .from("agents")
      .select("id, config")
      .eq("user_id", session.userId)
      .eq("template_id", HEAD_AGENT.id)
      .maybeSingle<{ id: string; config: Record<string, string> | null }>();

    if (head) {
      await admin
        .from("agents")
        .update({
          ...(headName ? { name: headName } : {}),
          ...(headConfig ? { config: { ...(head.config ?? {}), ...headConfig } } : {}),
        })
        .eq("id", head.id);
    }
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const commander = headName ?? HEAD_AGENT.defaultName;

  return NextResponse.json({
    created: result.created,
    skipped: result.existing,
    message:
      result.created > 0
        ? `${commander} is in command, with ${result.existing + result.created - 1} agents reporting.`
        : "Your whole army is already on the board.",
  });
}
