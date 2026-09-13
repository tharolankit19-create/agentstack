import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { sendMessage } from "@/lib/telegram";
import { countToday, digestText } from "@/lib/digest";
import { HEAD_AGENT } from "@/lib/army";
import { chatComplete, chatKeyFor, systemPromptFor } from "@/lib/chat-model";
import { userEntitled } from "@/lib/entitlement";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizeCron(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: headRows } = await admin.from("agents").select("*").eq("template_id", HEAD_AGENT.id).eq("status", "deployed").eq("paused", false).limit(500);
  const rows = (headRows ?? []) as Agent[];
  let sent = 0; let generated = 0;
  const results: { user: string; slot: string }[] = [];

  for (const head of rows) {
    if (!(await userEntitled(admin, head.user_id))) continue;
    const config = head.config ?? {};
    const slot = dueSlot(config);
    const timezone = config.timezone || "UTC";
    if (!slot || await alreadySent(admin, head.id, slot, timezone)) continue;
    const apiKey = await chatKeyFor(head.id); if (!apiKey) continue;
    const since = new Date(Date.now() - (slot === "morning" ? 18 : 12) * 60 * 60 * 1000).toISOString();
    const { data: gens } = await admin.from("generations").select("kind, content").eq("user_id", head.user_id).gte("created_at", since).order("created_at", { ascending: false }).limit(30);
    const produced = ((gens ?? []) as { kind: string; content: string }[]).map((g) => `- [${g.kind}] ${g.content.slice(0, 180)}`).join("\n");
    const ask = slot === "morning"
      ? "Give me the morning founder brief in 4-6 short lines: what changed, the biggest risk/opportunity, what the team did, and the ONE move that matters today. Mention a real milestone or trend only when evidence exists. End by asking if I want detail on research, SEO, funnel, content or leads."
      : "Give me the evening founder receipt in a few short lines: what shipped, what moved in the funnel, what is waiting for approval, and the one thing to watch tomorrow.";
    try {
      let text: string;
      if (slot === "evening") {
        const counts = await countToday(admin, head.user_id);
        text = digestText(counts, head.name || HEAD_AGENT.defaultName);
      } else {
        const system = await systemPromptFor(head);
        text = await chatComplete(apiKey, system, [{ role: "user", content: produced ? `${ask}\n\nVerified team output:\n${produced}` : `${ask}\n\nNo verified team output in this window. Say that plainly; do not invent progress.` }], head.template_id);
      }
      const { data: link } = await admin.from("telegram_links").select("chat_id").eq("user_id", head.user_id).maybeSingle<{ chat_id: string | null }>();
      const delivered = link?.chat_id ? await sendMessage(link.chat_id, text) : false;
      await admin.from("generations").insert({ agent_id: head.id, user_id: head.user_id, kind: "briefing", content: text, approved: true, meta: { slot, date: localDate(timezone), delivered: delivered ? "telegram" : "dashboard" } });
      generated += 1; if (delivered) sent += 1; results.push({ user: head.user_id, slot });
    } catch (cause) { console.error("[cron/briefing] failed for", head.user_id, cause); }
  }
  return NextResponse.json({ generated, sent, results });
}

type Slot = "morning" | "evening" | null;

function dueSlot(config: Record<string, string>): Slot {
  const tz = config.timezone || "UTC";
  let nowMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    nowMinutes = hour * 60 + minute;
  } catch { return null; }
  const morning = minuteOfDay(config.morningTime, 9 * 60);
  if (isDue(nowMinutes, morning)) return "morning";
  if (config.eveningTime && config.eveningTime !== "Off") {
    const evening = minuteOfDay(config.eveningTime, 19 * 60);
    if (isDue(nowMinutes, evening)) return "evening";
  }
  return null;
}

function minuteOfDay(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return fallback;
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
}

function isDue(now: number, target: number): boolean {
  const diff = now - target;
  return diff >= 0 && diff <= 15;
}

function localDate(tz: string): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

async function alreadySent(admin: ReturnType<typeof createAdminClient>, agentId: string, slot: string, timezone: string): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  const { data } = await admin.from("generations").select("id, meta").eq("agent_id", agentId).eq("kind", "briefing").gte("created_at", since).limit(10);
  const date = localDate(timezone);
  return ((data ?? []) as { meta: { slot?: string; date?: string } | null }[]).some((row) => row.meta?.slot === slot && row.meta?.date === date);
}
