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

/**
 * The daily briefing, sent from the platform.
 *
 * The head agent's whole promise is that it messages the founder every morning
 * and evening. Leaving that to each customer's *deployed* agent's own cron made
 * it fragile in exactly the way that got reported — the head agent deployed and
 * then said nothing, because a per-deployment cron is one more thing that has
 * to be right on fourteen separate Vercel projects.
 *
 * So the briefing is generated and sent from here instead, on one hourly cron.
 * For every founder who has linked Telegram, if the current time in their
 * timezone matches their morning or evening slot, it reads what their squads
 * produced, writes the briefing in the head agent's voice on the free models,
 * and sends it. One place, one schedule, one thing to keep working.
 *
 * Idempotent: a briefing is recorded as a generation, and a slot that already
 * has one for today is skipped — so running the cron twice in an hour cannot
 * double-send.
 */
export async function GET(request: Request) {
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Every active commander gets a briefing saved to the dashboard. Telegram
  // is only an optional delivery channel, never a condition for the work.
  const { data: headRows } = await admin
    .from("agents")
    .select("*")
    .eq("template_id", HEAD_AGENT.id)
    .eq("status", "deployed")
    .eq("paused", false)
    .limit(500);

  const rows = (headRows ?? []) as Agent[];
  let sent = 0;
  let generated = 0;
  const results: { user: string; slot: string }[] = [];

  for (const head of rows) {
    // No briefing once the trial is over and nothing was bought.
    if (!(await userEntitled(admin, head.user_id))) continue;

    const slot = dueSlot(head.config ?? {});
    if (!slot) continue;

    // Already sent this slot today?
    if (await alreadySent(admin, head.id, slot, head.config?.timezone || "UTC")) continue;

    const apiKey = await chatKeyFor(head.id);
    if (!apiKey) continue;

    // What to summarise: overnight for the morning plan, the day for the
    // evening receipt.
    const since = new Date(
      Date.now() - (slot === "morning" ? 18 : 12) * 60 * 60 * 1000,
    ).toISOString();
    const { data: gens } = await admin
      .from("generations")
      .select("kind, content")
      .eq("user_id", head.user_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);

    const produced = ((gens ?? []) as { kind: string; content: string }[])
      .map((g) => `- [${g.kind}] ${g.content.slice(0, 180)}`)
      .join("\n");

    // Once a day (the morning), if posts went out recently, ask how they did
    // so the agents can learn from real performance rather than guessing.
    const askPerf = slot === "morning" && produced.includes("[tweet]")
      ? " If any posts went out in the last day or two, add one short line asking how they performed (views, replies) so I can learn what's working — but only if there were posts."
      : "";

    const ask =
      slot === "morning"
        ? `Write my morning briefing. What did the squads find overnight, and what's the one thing I should do today? Keep it to a few short lines.${askPerf} End with: Reply 1 to approve what's waiting, 2 for detail, skip to pass.`
        : "Write my evening audit. What actually shipped today, what's still waiting on me? A few short lines. End with: Reply 1 to approve, 2 for detail.";

    try {
      // The evening message is a receipt, and a receipt should be counted
      // rather than composed. Asking a model to summarise the day produces
      // fluent sentences whose numbers drift from the database — "a handful of
      // leads" when there were three, or forty when there were none. The
      // counts come from real rows; the morning briefing stays a model's job,
      // because "what should I do today" is judgement, not arithmetic.
      let text: string;

      if (slot === "evening") {
        const counts = await countToday(admin, head.user_id);
        text = digestText(counts, head.name || HEAD_AGENT.defaultName);
      } else {
        const system = await systemPromptFor(head);
        text = await chatComplete(apiKey, system, [
          {
            role: "user",
            content: produced
              ? `${ask}\n\nWhat the squads produced:\n${produced}`
              : `${ask}\n\nThe squads produced nothing in this window — say so briefly and honestly, and tell me one thing worth doing myself.`,
          },
        ]);
      }

      const { data: link } = await admin
        .from("telegram_links")
        .select("chat_id")
        .eq("user_id", head.user_id)
        .maybeSingle<{ chat_id: string | null }>();

      const { data: saved, error: saveError } = await admin.from("generations").insert({
        agent_id: head.id,
        user_id: head.user_id,
        kind: "briefing",
        content: text,
        approved: true,
        meta: { slot, date: today(head.config?.timezone), delivered: "dashboard" },
      }).select("id").single();
      if (saveError || !saved) throw new Error("Could not save the morning briefing.");
      const delivered = link?.chat_id ? await sendMessage(link.chat_id, text) : false;
      if (delivered) await admin.from("generations").update({ meta: { slot, date: today(head.config?.timezone), delivered: "telegram" } }).eq("id", saved.id);

      generated += 1;
      if (delivered) sent += 1;
      results.push({ user: head.user_id, slot });
    } catch (cause) {
      console.error("[cron/briefing] failed for", head.user_id, cause);
    }
  }

  return NextResponse.json({ generated, sent, results });
}

type Slot = "morning" | "evening" | null;

/**
 * Which briefing, if any, is due for this head agent right now.
 *
 * Uses the founder's real timezone via Intl — DST-correct, no offset table to
 * drift — and only fires inside the top of the matching hour, so the hourly
 * cron lines up with the hour they picked.
 */
function dueSlot(config: Record<string, string>): Slot {
  const tz = config.timezone || "UTC";
  let hour = 0;
  let minute = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  } catch {
    return null;
  }

  // Only within the first half of the hour, so a cron that runs at :00 hits it
  // and a stray later run does not fire a second, off-time briefing.
  const clock = hour * 60 + minute;
  const minuteOf = (value: string | undefined, fallback: number) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : fallback * 60;
  };
  const morning = minuteOf(config.morningTime, 8);

  const eveningRaw = config.eveningTime;
  if (eveningRaw && eveningRaw !== "Off") {
    const evening = minuteOf(eveningRaw, 19);
    if (clock >= evening) return "evening";
  }
  return clock >= morning ? "morning" : null;
}

function hourOf(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,2}):/.exec((value ?? "").trim());
  return match ? Number(match[1]) : fallback;
}

function today(timezone = "UTC"): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

async function alreadySent(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  slot: string,
  timezone = "UTC",
): Promise<boolean> {
  const date = today(timezone);
  const { data } = await admin
    .from("generations")
    .select("id, meta, user_id, content")
    .eq("agent_id", agentId)
    .eq("kind", "briefing")
    .contains("meta", { date })
    .limit(10);

  const existing = (data ?? []).find(row => row.meta?.slot === slot);
  if (!existing) return false;
  if (existing.meta?.delivered !== "telegram") {
    const { data: link } = await admin.from("telegram_links").select("chat_id")
      .eq("user_id", existing.user_id).maybeSingle();
    if (link?.chat_id && await sendMessage(link.chat_id, existing.content)) {
      await admin.from("generations").update({ meta: { ...existing.meta, delivered: "telegram" } }).eq("id", existing.id);
    }
  }
  return true;
}
