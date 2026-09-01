import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { chatKeyFor, businessConfigFor } from "@/lib/chat-model";
import { loadConnectors, houseMonidKey, houseFirecrawlKey } from "@/lib/connectors";
import { userEntitled } from "@/lib/entitlement";
import { markWorking } from "@/lib/agent-activity";
import { HEAD_AGENT } from "@/lib/army";
import {
  findLeads,
  qualifyLeads,
  enrichLeads,
  writeEmails,
  sendApproved,
  deriveIcp,
  DAILY_LEAD_TARGET,
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

  const rows = (heads ?? []) as Agent[];
  const report: Record<string, unknown>[] = [];

  for (const head of rows.slice(0, MAX_FOUNDERS)) {
    if (!(await userEntitled(admin, head.user_id))) continue;

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

    // Top up only if today is short of the promise. Counting what already
    // arrived today is what makes "fifty a day" a target rather than a rate:
    // a tick that finds forty does not then find fifty more on the next one.
    if (monidKey) {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", head.user_id)
        .gte("created_at", since.toISOString());

      const shortfall = DAILY_LEAD_TARGET - (count ?? 0);
      if (shortfall > 0) {
        stages.find = await findLeads(
          admin,
          head.user_id,
          monidKey,
          icp,
          Math.min(shortfall, 25),
        );
      }
    }

    report.push({ user: head.user_id, ...stages });
  }

  return NextResponse.json({ founders: report.length, report });
}
