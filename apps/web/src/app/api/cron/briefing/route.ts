import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/crypto";
import { sendMessage } from "@/lib/telegram";
import { chatComplete, chatKeyFor, systemPromptFor } from "@/lib/chat-model";
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
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!timingSafeEqualStrings(token, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Everyone who can actually receive a briefing.
  const { data: links } = await admin
    .from("telegram_links")
    .select("user_id, chat_id")
    .not("chat_id", "is", null)
    .limit(500);

  const rows = (links ?? []) as { user_id: string; chat_id: string }[];
  let sent = 0;
  const results: { user: string; slot: string }[] = [];

  for (const link of rows) {
    const { data: head } = await admin
      .from("agents")
      .select("*")
      .eq("user_id", link.user_id)
      .eq("template_id", "head-agent")
      .maybeSingle<Agent>();

    if (!head || head.status !== "deployed" || head.paused) continue;

    const slot = dueSlot(head.config ?? {});
    if (!slot) continue;

    // Already sent this slot today?
    if (await alreadySent(admin, head.id, slot)) continue;

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
      .eq("user_id", link.user_id)
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
      const system = await systemPromptFor(head);
      const text = await chatComplete(apiKey, system, [
        {
          role: "user",
          content: produced
            ? `${ask}\n\nWhat the squads produced:\n${produced}`
            : `${ask}\n\nThe squads produced nothing in this window — say so briefly and honestly, and tell me one thing worth doing myself.`,
        },
      ]);

      const ok = await sendMessage(link.chat_id, text);
      if (!ok) continue;

      await admin.from("generations").insert({
        agent_id: head.id,
        user_id: link.user_id,
        kind: "briefing",
        content: text,
        approved: true,
        meta: { slot, date: today() },
      });

      sent += 1;
      results.push({ user: link.user_id, slot });
    } catch (cause) {
      console.error("[cron/briefing] failed for", link.user_id, cause);
    }
  }

  return NextResponse.json({ sent, results });
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
  if (minute >= 30) return null;

  const morning = hourOf(config.morningTime, 9);
  if (hour === morning) return "morning";

  const eveningRaw = config.eveningTime;
  if (eveningRaw && eveningRaw !== "Off") {
    const evening = hourOf(eveningRaw, 19);
    if (hour === evening) return "evening";
  }
  return null;
}

function hourOf(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,2}):/.exec((value ?? "").trim());
  return match ? Number(match[1]) : fallback;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function alreadySent(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  slot: string,
): Promise<boolean> {
  const startOfDay = `${today()}T00:00:00.000Z`;
  const { data } = await admin
    .from("generations")
    .select("id, meta")
    .eq("agent_id", agentId)
    .eq("kind", "briefing")
    .gte("created_at", startOfDay)
    .limit(10);

  return ((data ?? []) as { meta: { slot?: string } | null }[]).some(
    (row) => row.meta?.slot === slot,
  );
}
