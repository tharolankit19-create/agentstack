import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { chatKeyFor, businessConfigFor } from "@/lib/chat-model";
import { loadConnectors, houseMonidKey, houseFirecrawlKey } from "@/lib/connectors";
import { userEntitled } from "@/lib/entitlement";
import { markWorking } from "@/lib/agent-activity";
import { HEAD_AGENT } from "@/lib/army";
import {
  topUpLeads,
  qualifyLeads,
  enrichLeads,
  writeEmails,
  sendApproved,
  deriveIcp,
} from "@/lib/pipeline";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The outreach squad, working as a squad.
 *
 * The other cron runs each agent alone and files what it produced. This one
 * runs the five of them as one line of work, because that is what outreach
 * actually is: the filter has nothing to judge until the finder has found, and
 * the writer has nobody to write to until the filter has kept someone.
 *
 * Every stage runs every tick, and each is bounded. That ordering matters more
 * than it looks: the tail of the pipeline is drained before the head is topped
 * up, so leads already paid for are carried to a written email before more are
 * bought. A pipeline that searched first would spend money widening a queue it
 * was not clearing.
 *
 * Nothing here sends without approval, and the day's send cap is enforced
 * inside the send stage rather than here, so it holds no matter who calls it.
 */

/** How many founders to serve per tick, so one slow account cannot block the rest. */
const MAX_FOUNDERS = 8;

export async function GET(request: Request) {
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Every founder with a head agent — the head agent is where the business
  // context and timezone live, so a founder without one has nothing to aim a
  // search at yet.
  const { data: heads } = await admin
    .from("agents")
    .select("id, user_id, template_id, name, config, status, paused")
    .eq("template_id", HEAD_AGENT.id)
    .limit(200);

  // Whose lead agent has waited longest. This used to be `rows.slice(0, 8)` on
  // an unordered query, which meant the same eight founders were served on
  // every tick and the ninth was never served at all — the promise held for
  // whoever the database happened to return first.
  const { data: workers } = await admin
    .from("agents")
    .select("id, user_id, last_run_at")
    .eq("template_id", "lead-agent")
    .eq("paused", false)
    .limit(400);

  const waited = new Map(
    ((workers ?? []) as { user_id: string; id: string; last_run_at: string | null }[]).map(
      (row) => [row.user_id, row],
    ),
  );

  const rows = ((heads ?? []) as Agent[])
    .filter((head) => waited.has(head.user_id))
    .sort((a, b) => {
      // Morning first. "Fifty leads every morning" is a promise about the state
      // of the dashboard when the founder opens it, so a founder whose night is
      // ending outranks one who is mid-afternoon — their remaining ticks are
      // the ones that still count.
      const dawn = Number(isPreDawn(b)) - Number(isPreDawn(a));
      if (dawn !== 0) return dawn;

      const at = waited.get(a.user_id)?.last_run_at;
      const bt = waited.get(b.user_id)?.last_run_at;
      if (at === bt) return 0;
      if (!at) return -1;
      if (!bt) return 1;
      return at < bt ? -1 : 1;
    });

  const report: Record<string, unknown>[] = [];
  let served = 0;

  for (const head of rows) {
    if (served >= MAX_FOUNDERS) break;
    if (!(await userEntitled(admin, head.user_id))) continue;

    // Claim the turn on the lead agent's own row, by exact compare-and-swap.
    // Two overlapping ticks would otherwise both serve the founder at the top
    // of the list and pay for the same searches twice.
    const worker = waited.get(head.user_id)!;
    const claim = admin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", worker.id);
    const { data: claimed } = await (
      worker.last_run_at
        ? claim.eq("last_run_at", worker.last_run_at)
        : claim.is("last_run_at", null)
    ).select("id");
    if (!claimed?.length) continue;

    served += 1;

    const config = await businessConfigFor(head);
    const connectors = await loadConnectors(admin, head.user_id);
    const monidKey = connectors.monid ?? (await houseMonidKey(admin));
    const modelKey = await chatKeyFor(head.id);

    let icp = config.icp || config.audience || config.customer || "";

    // Onboarding stops asking who buys it, so the first tick works it out from
    // the site. Once, and written back — a founder who never fills that field
    // in still gets a working lead search, which is the whole reason the
    // question was dropped from signup.
    if (!icp.trim() && modelKey) {
      const site = config.websiteUrl || config.siteUrl || "";
      const firecrawl = connectors.firecrawl ?? (await houseFirecrawlKey(admin));
      icp = (await deriveIcp(admin, head.id, modelKey, site, firecrawl)) ?? "";
    }

    // Still nothing to aim at. Better to do nothing than to search for
    // "everyone" and bill the founder for the result.
    if (!icp.trim()) {
      report.push({ user: head.user_id, skipped: "no customer profile yet" });
      continue;
    }

    const timezone = config.timezone || "UTC";
    const stages: Record<string, unknown> = {};

    await markWorking(admin, head.user_id, "lead-agent", "working the outreach pipeline", 240);

    // Drain first, fill last. See the note above — this order is the difference
    // between a pipeline and a growing pile.
    if (modelKey) {
      const from = config.fromEmail || config.senderEmail || "";
      if (connectors.resend && from) {
        stages.send = await sendApproved(
          admin,
          head.user_id,
          connectors.resend,
          from,
          timezone,
          config.replyTo || undefined,
        );
      }

      stages.write = await writeEmails(admin, head.user_id, modelKey, {
        businessContext: config.businessContext ?? "",
        senderName: config.founderName || config.senderName || "the founder",
        offer: config.offer ?? "",
      });
    }

    if (monidKey) {
      stages.enrich = await enrichLeads(admin, head.user_id, monidKey);
    }

    if (modelKey) {
      stages.qualify = await qualifyLeads(admin, head.user_id, modelKey, icp);
    }

    // Top up to the day's promise, in the founder's own day — a UTC boundary
    // rolls over at half past five in the morning in Delhi, which reset the
    // target in front of the founder it was made to.
    //
    // `topUpLeads` searches from several angles rather than asking the same
    // question repeatedly. That is what makes fifty reachable at all: one
    // string returns one page of results, so the old single-query version
    // added twenty-five leads on its first tick and nothing on any tick after,
    // at full price each time.
    if (monidKey) {
      stages.find = await topUpLeads(
        admin,
        head.user_id,
        monidKey,
        modelKey,
        icp,
        timezone,
      );
    }

    report.push({ user: head.user_id, ...stages });
  }

  return NextResponse.json({ founders: report.length, report });
}

/**
 * Is it the small hours where this founder lives?
 *
 * Three to nine: late enough that the night's work is nearly done, early enough
 * that there are ticks left to finish it. Falls back to false rather than
 * throwing on a timezone string the founder typed by hand — a bad value should
 * cost that account its place in the queue, not everyone else's tick.
 */
function isPreDawn(head: Agent): boolean {
  const timezone = (head.config as Record<string, string> | null)?.timezone;
  if (!timezone) return false;
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
      }).format(new Date()),
    );
    return hour >= 3 && hour < 9;
  } catch {
    return false;
  }
}
