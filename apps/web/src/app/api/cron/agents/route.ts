import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { userEntitled } from "@/lib/entitlement";
import { getTemplate } from "@/lib/templates";
import { HEAD_AGENT } from "@/lib/army";
import { isDue, intervalMinutes, morningDue } from "@/lib/cadence";
import { runAgentOnce } from "@/lib/run-agent";
import { businessConfigFor } from "@/lib/chat-model";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Scheduled and interactive work use the same tools, persistence and reports. */
export async function GET(request: Request) {
  if (!(await authorizeCron(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("agents").select("*")
    .neq("template_id", HEAD_AGENT.id).eq("status", "deployed").eq("paused", false)
    .order("last_run_at", { ascending: true, nullsFirst: true }).limit(400);
  if (error) return NextResponse.json({ error: "Could not load scheduled agents." }, { status: 503 });
  let ran = 0;
  let attempted = 0;
  const started = Date.now();
  const entitledCache = new Map<string, boolean>();
  const results: { agent: string; ok: boolean; reason: string | null }[] = [];
  const agents = ((rows ?? []) as Agent[]).sort((a, b) => Number(b.template_id === "lead-agent") - Number(a.template_id === "lead-agent"));
  for (const agent of agents) {
    if (attempted >= 4 || Date.now() - started > 210_000) break;
    const template = getTemplate(agent.template_id);
    if (!template?.scheduledTask) continue;
    let entitled = entitledCache.get(agent.user_id);
    if (entitled === undefined) {
      entitled = await userEntitled(admin, agent.user_id);
      entitledCache.set(agent.user_id, entitled);
    }
    if (!entitled) continue;
    if (agent.template_id === "lead-agent") {
      const config = await businessConfigFor(agent);
      if (!morningDue(agent.last_run_at, config.timezone || "UTC", config.morningTime || "08:00")) continue;
    } else if (!isDue(template.frequency, agent.last_run_at)) continue;
    const claimAt = new Date().toISOString();
    const claim = admin.from("agents").update({ last_run_at: claimAt }).eq("id", agent.id);
    const { data: claimed } = await (agent.last_run_at ? claim.eq("last_run_at", agent.last_run_at) : claim.is("last_run_at", null)).select("id");
    if (!claimed?.length) continue;
    attempted++;
    let result;
    try { result = await runAgentOnce(admin, agent, { announce: true }); }
    catch (cause) { result = { ok: false, reason: cause instanceof Error ? cause.message : "Run failed." }; }
    results.push({ agent: agent.id, ok: result.ok, reason: result.reason });
    if (result.ok) ran++;
    else {
      const retryAt = new Date(Date.now() - Math.max(intervalMinutes(template.frequency) - 30, 0) * 60_000).toISOString();
      await admin.from("agents").update({ last_run_at: retryAt, last_error: result.reason }).eq("id", agent.id).eq("last_run_at", claimAt);
    }
  }
  return NextResponse.json({ ran, attempted, results });
}
