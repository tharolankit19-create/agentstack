import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAgentOnce } from "@/lib/run-agent";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * "Run now" — the agent does its job this second instead of on its schedule.
 *
 * This used to call the customer's *deployed* agent over HTTP, from the era
 * when each of them hosted their own copy. On the platform-hosted model that
 * URL does not exist, so the button called nothing: the founder pressed it,
 * nothing happened, and the only honest reading was that the agents were
 * decorative.
 *
 * It now runs the same function the cron runs. Identical path on purpose — a
 * manual run that took a different route would drift from the scheduled one,
 * and the founder would be testing something other than what runs overnight.
 *
 * An optional `instruction` replaces the standing job for this run, which is
 * what makes "audit the pricing page" different from "do your weekly audit".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // A run costs real money — a model call, and often a data lookup. The limit
  // is per founder rather than per agent, because thirteen agents at twenty
  // runs each is the same bill however it is spread.
  const limit = rateLimit(`run:${auth.session.userId}`, 30, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of manual runs this hour. The schedule still works." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { instruction?: string };
  const instruction =
    typeof body.instruction === "string" ? body.instruction.slice(0, 600) : undefined;

  // Read through the admin client but scoped to this founder's own row, so a
  // guessed id belonging to someone else is a 404 rather than a run they paid
  // for on a stranger's behalf.
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from("agents")
    .select("id, user_id, template_id, name, config, paused")
    .eq("id", id)
    .eq("user_id", auth.session.userId)
    .maybeSingle<Agent>();

  if (!agent) {
    return NextResponse.json({ error: "No such agent." }, { status: 404 });
  }

  const result = await runAgentOnce(admin, agent, {
    instruction,
    label: instruction ? "on the job you just gave it" : "running now",
    // The founder pressed a button and can now close the tab. A run can take
    // a minute; telling them when it lands is the difference between a product
    // that works for you and one you have to sit and watch.
    notify: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    generationId: result.generationId,
    content: result.content,
  });
}
