import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqualStrings } from "@/lib/crypto";
import { sendMessage, webhookSecret } from "@/lib/telegram";
import {
  ChatModelError,
  chatKeyFor,
  respondAsAgent,
  type ChatTurn,
} from "@/lib/chat-model";
import { parseSchedule } from "@/lib/schedule";
import { postTweet } from "@/lib/xquik";
import { loadConnectors } from "@/lib/connectors";
import type { Agent, Generation } from "@/lib/supabase/types";

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

/**
 * Is the route even deployed, and is it configured?
 *
 * A bot that does not answer has four possible causes and they are
 * indistinguishable from the outside: the code is not deployed, the secret is
 * unset, the webhook was never registered, or it was registered pointing
 * somewhere else. This GET settles the first two from a phone browser with no
 * login — which matters, because when the bot is broken the dashboard is often
 * the thing you cannot check.
 *
 * Booleans only, never the secret itself. `/api/health` already reports the
 * same fact publicly, so this reveals nothing new.
 */
export function GET() {
  return NextResponse.json({
    route: "live",
    secretConfigured: Boolean(webhookSecret()),
    tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hint: webhookSecret()
      ? "Route is ready. If the bot is still silent, the webhook is not registered — POST /api/telegram/setup as an admin."
      : "No webhook secret available. Set SECRETS_ENCRYPTION_KEY (which the app already needs) and one is derived automatically.",
  });
}

export async function POST(request: Request) {
  // Derived from SECRETS_ENCRYPTION_KEY when TELEGRAM_WEBHOOK_SECRET is unset,
  // so the two ends agree without a second env var to forget. The setWebhook
  // call computes the exact same value.
  const expected = webhookSecret();
  const provided = request.headers.get("x-telegram-bot-api-secret-token");

  // Three different failures used to collapse into one silent `ok:false` with
  // nothing written anywhere. That is the worst possible behaviour for the one
  // endpoint whose symptom is silence: the bot looks broken, the logs look
  // empty, and there is no way to tell which of the three it was. It still
  // answers the caller identically — a prober learns nothing — but the server
  // log now says exactly what happened.
  if (!expected) {
    console.error(
      "[telegram] no webhook secret available (neither TELEGRAM_WEBHOOK_SECRET nor " +
        "SECRETS_ENCRYPTION_KEY is set) — rejecting an update. The bot cannot reply until one exists.",
    );
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!provided) {
    console.error(
      "[telegram] update arrived with no secret-token header. The webhook was registered " +
        "without a secret_token; re-register it (POST /api/telegram/setup) so Telegram sends one.",
    );
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (!timingSafeEqualStrings(expected, provided)) {
    console.error(
      "[telegram] secret-token mismatch. The webhook was registered with a different value " +
        "than TELEGRAM_WEBHOOK_SECRET currently holds — re-register it.",
    );
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
    //
    // Two ways in, and the first is the one almost everybody uses: tapping the
    // dashboard's connect link opens this chat with a START button, and
    // pressing it sends "/start 123456". The founder types nothing. Typing the
    // code by hand still works, because a link opened on a laptop and a bot
    // opened on a phone are two different devices.
    const redeemed = await redeemCode(text, String(chatId));

    if (redeemed) {
      await reply(
        chatId,
        "Connected. This is where your briefings arrive, at the times you set in the dashboard.\n\n" +
          "1 — approve everything waiting\n" +
          "2 — see the drafts\n" +
          "skip — do nothing today\n" +
          "status — what is running",
      );
      return NextResponse.json({ ok: true });
    }

    // A bare /start with no payload is somebody who found the bot on their
    // own, so it gets an instruction rather than an error.
    const bare = /^\/?start$/i.test(text);
    await reply(
      chatId,
      bare
        ? "Hello. I am your head agent — but I do not know which account you are yet.\n\n" +
            "Open your dashboard, press “Connect Telegram”, and tap the button it gives you. It brings you straight back here and connects us.\n\n" +
            "If you are on a laptop, send me the 6-digit code instead."
        : "I do not recognise this chat yet. Send me the 6-digit code from your dashboard, or tap the connect button there.",
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
  // A standalone run of exactly six digits: "123456", or "/start 123456" from
  // the deep link. Stripping every non-digit from the whole message instead
  // would turn "call me on 12 34 56" into a redemption attempt, and worse,
  // would silently burn a code the founder had not meant to send.
  const found = /(?:^|\s)(\d{6})(?:\s|$)/.exec(text.replace(/^\/start\b/i, " "));
  const code = found?.[1];
  if (!code) return false;

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

    const tweets = items.filter((item) => item.kind === "tweet");
    const otherPosts = items.filter((item) => item.kind === "linkedin");
    const rest = items.length - tweets.length - otherPosts.length;
    const parts: string[] = [];
    if (rest > 0) parts.push(`${rest} queued for the next run`);

    // When X is connected through Xquik, approval actually posts the tweets —
    // this is the close of the loop the founder asked for. Without it, or for
    // LinkedIn (not an Xquik surface), the wording stays honest: written for
    // you to publish, never silently claimed as sent.
    // The founder's own X key (from their connectors) wins over the platform's.
    const connectors = await loadConnectors(admin, userId);
    const xKey = connectors.x ?? process.env.XQUIK_API_KEY?.trim();
    if (tweets.length > 0 && xKey) {
      let posted = 0;
      let failed = 0;
      for (const tweet of tweets as Pick<Generation, "content">[]) {
        const result = await postTweet(tweet.content, xKey);
        if (result.ok) posted += 1;
        else failed += 1;
      }
      if (posted > 0) parts.push(`${posted} posted to X`);
      if (failed > 0) parts.push(`${failed} couldn't post — X not connected?`);
    } else if (tweets.length > 0) {
      parts.push(
        `${tweets.length} ${tweets.length === 1 ? "tweet" : "tweets"} ready for you to post — reply 2 to copy`,
      );
    }
    if (otherPosts.length > 0) {
      parts.push(
        `${otherPosts.length} LinkedIn ${otherPosts.length === 1 ? "post" : "posts"} for you to publish — reply 2 to copy`,
      );
    }

    return `Approved ${items.length}. ${parts.join(". ")}.`;
  }

  if (command === "2" || command === "detail" || command === "details") {
    if (items.length === 0) return "Nothing is waiting for approval right now.";

    // Three at a time. A phone message with twenty drafts in it is not detail,
    // it is a wall nobody reads.
    return items
      .slice(0, 3)
      .map(
        (item, index) =>
          `${index + 1}. [${item.kind}] ${item.content.slice(0, 280)}${item.content.length > 280 ? "…" : ""}` +
          (item.kind === "tweet" || item.kind === "linkedin"
            ? "\n   ↑ copy and post this yourself"
            : ""),
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
      "You get two messages a day: a plan in the morning and an audit in the " +
      "evening. Social posts are written for you but never published " +
      "automatically — you post those yourself."
    );
  }

  // Anything else is a real message to the head agent — so answer it as one.
  // The founder can hold an actual conversation on Telegram, not just fire the
  // four commands. It runs on the platform's free models, so chatting costs
  // them nothing, and the transcript is stored so the dashboard and Telegram
  // share one thread.
  void chatId;
  return chatWithHeadAgent(userId, text);
}

/**
 * A free-text turn with the head agent, over Telegram.
 *
 * Deliberately the same model path as the dashboard chat, reading and writing
 * the same `chat_messages`, so a conversation started in one place continues in
 * the other. Returns a readable sentence on any failure — a founder on a phone
 * cannot open dev tools.
 */
async function chatWithHeadAgent(userId: string, text: string): Promise<string> {
  const admin = createAdminClient();

  const { data: head } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .eq("template_id", "head-agent")
    .maybeSingle<Agent>();

  if (!head) {
    return "Your head agent is not set up yet. Open your dashboard to create it.";
  }

  // "At 5pm, write the launch post and message me" — a real timed instruction,
  // not a chat. File it and confirm like a colleague; the tasks cron does it at
  // 5pm and messages the result.
  const schedule = parseSchedule(text, head.config?.timezone ?? "UTC");
  if (schedule && schedule.task) {
    await admin.from("scheduled_tasks").insert({
      user_id: userId,
      agent_id: head.id,
      instruction: schedule.task,
      run_at: schedule.runAt.toISOString(),
      when_label: schedule.whenLabel,
    });
    // Store the exchange so it stays in the shared thread.
    await admin.from("chat_messages").insert([
      { agent_id: head.id, user_id: userId, role: "user", content: text },
      {
        agent_id: head.id,
        user_id: userId,
        role: "assistant",
        content: `Got it. I'll ${schedule.task} ${schedule.whenLabel} and message you when it's done.`,
      },
    ]);
    return `Got it. I'll ${schedule.task} ${schedule.whenLabel} and message you when it's done.`;
  }

  const apiKey = await chatKeyFor(head.id);
  if (!apiKey) {
    return "Chat is not configured on the server yet. Reply 1, 2, skip or status in the meantime.";
  }

  const { data: history } = await admin
    .from("chat_messages")
    .select("role, content")
    .eq("agent_id", head.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const turns: ChatTurn[] = ((history ?? []) as { role: "user" | "assistant"; content: string }[])
    .map((row) => ({ role: row.role, content: row.content }));
  turns.push({ role: "user", content: text });

  try {
    const replyText = await respondAsAgent(head, turns, apiKey);

    await admin.from("chat_messages").insert([
      { agent_id: head.id, user_id: userId, role: "user", content: text },
      { agent_id: head.id, user_id: userId, role: "assistant", content: replyText },
    ]);

    return replyText;
  } catch (cause) {
    if (cause instanceof ChatModelError) return cause.message;
    console.error("[telegram] chat failed:", cause);
    return "I could not answer that just now. Try again in a moment.";
  }
}

async function reply(chatId: number, text: string): Promise<void> {
  // A failed send must not fail the webhook — Telegram would retry the whole
  // update and we would approve the same batch twice. `sendMessage` already
  // swallows its own errors for exactly that reason.
  await sendMessage(chatId, text);
}
