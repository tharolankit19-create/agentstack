import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { diagnose } from "@/lib/diagnosis";
import { sendMessage } from "@/lib/telegram";
import { HEAD_AGENT } from "@/lib/army";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Quiet health watch. It never sends an hourly "all good" message. A founder is
 * interrupted only when a new blocker/warning appears or materially changes.
 */
export async function GET(request: Request) {
  if (!(await authorizeCron(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: links } = await admin.from("telegram_links").select("user_id, chat_id").not("chat_id", "is", null).limit(500);
  let scanned = 0; let sent = 0;

  for (const link of (links ?? []) as { user_id: string; chat_id: string }[]) {
    scanned += 1;
    try {
      const result = await diagnose(link.user_id);
      const problems = result.checks.filter((c) => c.severity !== "ok");
      if (!problems.length) continue;
      const body = problems.slice(0, 3).map((c) => `${c.severity === "blocker" ? "⚠️" : "•"} ${c.title}${c.fix ? `\n  Fix: ${c.fix}` : ""}`).join("\n");
      const fingerprint = createHash("sha256").update(body).digest("hex").slice(0, 16);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: old } = await admin.from("generations").select("meta").eq("user_id", link.user_id).eq("kind", "diagnosis-alert").gte("created_at", since).limit(20);
      if (((old ?? []) as { meta?: { fingerprint?: string } }[]).some((row) => row.meta?.fingerprint === fingerprint)) continue;

      const text = `Quick diagnosis:\n${body}\n\nWant the full breakdown? Reply “diagnose”.`;
      if (!(await sendMessage(link.chat_id, text))) continue;
      const { data: head } = await admin.from("agents").select("id").eq("user_id", link.user_id).eq("template_id", HEAD_AGENT.id).maybeSingle<{ id: string }>();
      await admin.from("generations").insert({ agent_id: head?.id ?? null, user_id: link.user_id, kind: "diagnosis-alert", content: text, approved: true, meta: { fingerprint } });
      sent += 1;
    } catch (cause) {
      console.error("[cron/diagnosis] failed", link.user_id, cause);
    }
  }
  return NextResponse.json({ scanned, sent });
}
