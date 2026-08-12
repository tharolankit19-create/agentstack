import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { isAdmin } from "@/lib/plans";
import { appUrl } from "@/lib/deploy";
import {
  botIdentity,
  botToken,
  registerWebhook,
  webhookInfo,
  webhookSecret,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finish installing the bot, and find out why it is not answering.
 *
 * A Telegram bot with no registered webhook receives every message and
 * forwards none of them. From the outside that is indistinguishable from a
 * broken bot, a wrong token, or a bug in the reply logic — which is why this
 * endpoint reports all four separately instead of returning a boolean.
 *
 * GET diagnoses. POST registers. Admin only: it is a one-line operation that
 * decides where every customer's messages get delivered.
 */

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.session.profile)) {
    return NextResponse.json({ error: "Not yours." }, { status: 403 });
  }

  return NextResponse.json(await diagnose());
}

export async function POST() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.session.profile)) {
    return NextResponse.json({ error: "Not yours." }, { status: 403 });
  }

  const base = appUrl();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_APP_URL is not set, so there is no address to give Telegram. Set it to your live https:// URL and try again.",
      },
      { status: 400 },
    );
  }

  const target = `${base.replace(/\/+$/, "")}/api/telegram/webhook`;

  // Telegram refuses plain http, and the failure message it returns for it is
  // vague enough to cost an afternoon.
  if (!target.startsWith("https://")) {
    return NextResponse.json(
      { error: `Telegram only delivers to https. Yours is ${target}.` },
      { status: 400 },
    );
  }

  const result = await registerWebhook(target);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.description ?? "Telegram refused the webhook.", target },
      { status: 502 },
    );
  }

  return NextResponse.json({ registered: true, target, ...(await diagnose()) });
}

/**
 * Every reason the bot could be silent, checked separately.
 *
 * The point is that each line here is independently actionable. "It does not
 * work" is not a bug report; "token present, webhook url empty" is a fix.
 */
async function diagnose() {
  const base = appUrl();
  const expected = base ? `${base.replace(/\/+$/, "")}/api/telegram/webhook` : null;

  const me = await botIdentity();
  const info = await webhookInfo();
  const registered = info.result?.url ?? "";

  const problems: string[] = [];

  if (!botToken()) {
    problems.push("TELEGRAM_BOT_TOKEN is not set.");
  } else if (!me) {
    problems.push(
      "Telegram does not recognise TELEGRAM_BOT_TOKEN. Re-copy it from @BotFather — a stray quote or space is the usual cause.",
    );
  }

  if (!webhookSecret()) {
    problems.push(
      "No webhook secret available. Set SECRETS_ENCRYPTION_KEY (which the app already needs) and one is derived automatically, or set TELEGRAM_WEBHOOK_SECRET explicitly.",
    );
  }

  if (!expected) {
    problems.push("NEXT_PUBLIC_APP_URL is not set, so there is no address to register.");
  } else if (!registered) {
    problems.push(
      "No webhook is registered. This is almost always the reason the bot does not reply — POST to this endpoint to fix it.",
    );
  } else if (registered !== expected) {
    // The specific version of this that is worth naming: a bot can have
    // exactly one webhook, so pointing the token at any third-party bot host
    // — TeleBotHost, Manybot, BotFather's own hosting, an n8n node — hands
    // that service every update and leaves this app permanently deaf. It is
    // not a misconfiguration anyone would guess at, because both ends stay
    // silent rather than erroring.
    problems.push(
      `Another service owns this bot's webhook: ${registered}. ` +
        "A Telegram bot can only have one webhook, so every message is going " +
        "there and none of them reach us. Remove the bot from that service " +
        "(or make a second bot in @BotFather for this app), then register " +
        `${expected} here.`,
    );
  }

  if (info.result?.last_error_message) {
    problems.push(
      `Telegram's last delivery failed: ${info.result.last_error_message}`,
    );
  }

  return {
    ok: problems.length === 0,
    bot: me ? { username: me.username, name: me.first_name } : null,
    hasToken: Boolean(botToken()),
    hasSecret: Boolean(webhookSecret()),
    expectedWebhook: expected,
    registeredWebhook: registered || null,
    pendingUpdates: info.result?.pending_update_count ?? null,
    lastError: info.result?.last_error_message ?? null,
    problems,
  };
}
