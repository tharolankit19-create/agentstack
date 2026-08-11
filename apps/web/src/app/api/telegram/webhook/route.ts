import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The founder replying to their briefing.
 *
 * The head agent sends a message ending in "Reply 1 to approve all · 2 for
 * detail · skip". This is where that reply lands, and it is the half of
 * human-in-the-loop that makes the other half meaningful: the agents draft,
 * the founder decides, and the decision has to be one keystroke on a phone or
 * it does not happen.
 *
 * ## Why this is safe to leave open
 *
 * Telegram calls this URL from their infrastructure, unauthenticated. Two
 * things stop it being an open door:
 *
 *   1. **The secret token.** Telegram echoes back whatever we set when
 *      registering the webhook, in `X-Telegram-Bot-Api-Secret-Token`. A
 *      request without it is not from Telegram and is dropped before anything
 *      is read. Compared in constant time, because a timing oracle on a
 *      webhook secret is still a timing oracle.
 *   2. **The chat id is the identity.** We do not trust anything in the body
 *      about who the sender is; we look up which account has registered that
 *      chat id. An unknown chat gets a polite refusal and nothing else — no
 *      hint about whether the account exists.
 *
 * It always returns 200. Telegram retries non-2xx responses for hours, and a
 * retry storm caused by our own bug is worse than a dropped message.
 */

interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { first_name?: string };
  };
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");

  if (!expected || !provided || !timingSafeEqualStrings(expected, provided)) {
    // 200 with ok:false — a 401 tells a prober they found something real.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? "").trim();
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  // The chat id is the credential. Whoever registered it owns this account.
  const { data: link } = await admin
    .from("telegram_links")
    .select("user_id")
    .eq("chat_id", String(chatId))
    .maybeSingle<{ user_id: string }>();

  if (!link) {
    // Not linked yet — the only thing this chat may do is redeem a code.
    const redeemed = await redeemCode(text, String(chatId));
    await reply(
      chatId,
      redeemed
        ? "Connected. Your briefing arrives at the time you set in the dashboard.\n\nReply 1 to approve, 2 for detail, skip to pass, status for what is running."
        : "This chat is not connected yet. Open your dashboard, go to the Head " +
            "Agent, and send me the 6-digit code it shows you.",
    );
    return NextResponse.json({ ok: true });
  }

  const answer = await handleCommand(link.user_id, text, chatId);
  if (answer) await reply(chatId, answer);

  return NextResponse.json({ ok: true });
}

/**
 * Redeems a link code, single-use.
 *
 * The `.is("chat_id", null)` guard is what makes it single-use under
 * concurrency: two messages racing with the same code both pass the expiry
 * check, but only one update matches an unlinked row. The code is cleared in
 * the same statement, so it cannot be replayed even by the winner.
 */
async function redeemCode(text: string, chatId: string): Promise<boolean> {
  const code = text.replace(/\D/g, "");
  if (code.length !== 6) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("telegram_links")
    .update({
      chat_id: chatId,
      link_code: null,
      code_expires_at: null,
      linked_at: new Date().toISOString(),
    })
    .eq("link_code", code)
    .gt("code_expires_at", new Date().toISOString())
    .is("chat_id", null)
    .select("user_id");

  return Boolean(data && data.length > 0);
}

/**
 * What the founder's reply means.
 *
 * Deliberately tiny vocabulary. A briefing arriving at 9am is read in about
 * fifteen seconds, and the reply has to be answerable without remembering a
 * syntax — so it is one character, or a word anyone would guess.
 */
async function handleCommand(
  userId: string,
  text: string,
  chatId: number,
): Promise<string | null> {
  const admin = createAdminClient();
  const command = text.toLowerCase().replace(/^\/+/, "");

  // Everything pending approval, oldest first.
  const { data: pending } = await admin
    .from("generations")
    .select("id, kind, content, agent_id")
    .eq("user_id", userId)
    .eq("approved", false)
    .order("created_at", { ascending: true })
    .limit(25);

  const items = pending ?? [];

  if (command === "1" || command === "approve" || command === "yes") {
    if (items.length === 0) return "Nothing is waiting for approval right now.";

    await admin
      .from("generations")
      .update({ approved: true, approved_at: new Date().toISOString() })
      .in(
        "id",
        items.map((item) => item.id),
      );

    return `Approved ${items.length} ${items.length === 1 ? "item" : "items"}. They go out on the next run.`;
  }

  if (command === "2" || command === "detail" || command === "details") {
    if (items.length === 0) return "Nothing is waiting for approval right now.";

    // Three at a time. A phone message with twenty drafts in it is not detail,
    // it is a wall nobody reads.
    return items
      .slice(0, 3)
      .map(
        (item, index) =>
          `${index + 1}. [${item.kind}] ${item.content.slice(0, 280)}${item.content.length > 280 ? "…" : ""}`,
      )
      .join("\n\n")
      .concat(
        items.length > 3
          ? `\n\n…and ${items.length - 3} more. Reply 1 to approve everything.`
          : "\n\nReply 1 to approve.",
      );
  }

  if (command === "skip" || command === "no") {
    return "Skipped. Nothing sent, nothing deleted — it is all still in your dashboard.";
  }

  if (command === "status") {
    const { count } = await admin
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "deployed")
      .eq("paused", false);

    return `${count ?? 0} agents running. ${items.length} ${items.length === 1 ? "item" : "items"} waiting for you.`;
  }

  if (command === "start" || command === "help") {
    return (
      "I am your head agent.\n\n" +
      "1 — approve everything waiting\n" +
      "2 — see the drafts\n" +
      "skip — do nothing today\n" +
      "status — what is running\n\n" +
      "Your briefing arrives at the time you set in the dashboard."
    );
  }

  // Anything else is a question, and this endpoint is not the place to answer
  // one — saying so plainly beats an agent improvising a reply on a channel
  // where the founder cannot see what it is about to do.
  void chatId;
  return "I only understand 1, 2, skip and status here. For anything else, the dashboard chat can actually answer you.";
}

async function reply(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    // A failed reply must not fail the webhook — Telegram would retry the
    // whole update and we would approve the same batch twice.
  });
}
