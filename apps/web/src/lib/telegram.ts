import "server-only";
import { createHmac } from "node:crypto";

/**
 * The bot, from our side.
 *
 * There was a hole here big enough to explain the whole "the bot does not
 * reply" bug: the webhook route existed, the reply logic existed, the secret
 * comparison existed — and nothing in the codebase had ever told Telegram
 * where to deliver updates. A bot with no registered webhook receives every
 * message and forwards none of them, which looks exactly like a broken bot and
 * is actually an unfinished install step.
 *
 * So this module owns the whole conversation with Telegram's API, and
 * `/api/telegram/setup` is the one call that finishes the install.
 */

const API = "https://api.telegram.org";

export interface TelegramResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export function botToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  // A token pasted with quotes around it is the single most common way this
  // goes wrong, and Telegram's error for it is an unhelpful 404.
  return token ? token.replace(/^["']|["']$/g, "") : null;
}

/**
 * The secret Telegram must echo back on every update.
 *
 * This used to be a required environment variable, and its absence was the
 * single most common reason the bot stayed silent: unset, the webhook route
 * rejected every update, and nothing said why. A webhook secret does not need
 * to be human-chosen, though — it only needs to be unguessable and identical
 * on both ends. So when `TELEGRAM_WEBHOOK_SECRET` is not set we derive one
 * from `SECRETS_ENCRYPTION_KEY`, which is already required and already secret.
 *
 * Both the setWebhook call and the webhook handler compute it the same way, so
 * they always agree with nothing to configure. An explicitly set value still
 * wins, so anyone who wants to rotate it independently can.
 *
 * Telegram allows only `A-Za-z0-9_-` here, which hex satisfies.
 */
export function webhookSecret(): string | null {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicit) return explicit;

  const base = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!base) return null;

  return createHmac("sha256", base).update("telegram-webhook-v1").digest("hex");
}

async function call<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramResult<T>> {
  const token = botToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set." };

  try {
    const response = await fetch(`${API}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return (await response.json()) as TelegramResult<T>;
  } catch (cause) {
    return {
      ok: false,
      description: cause instanceof Error ? cause.message : "Telegram unreachable.",
    };
  }
}

export interface BotIdentity {
  id: number;
  username: string;
  first_name: string;
}

/**
 * Who the bot is, asked rather than configured.
 *
 * The username used to come from `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, which
 * meant the "open my bot" link silently did not render for anyone who set the
 * token and not that. The token already identifies the bot; asking Telegram
 * for the name that goes with it removes a variable that could only ever be
 * wrong or missing.
 *
 * Cached for the life of the process — a bot's username changes roughly never,
 * and calling getMe on every dashboard load would be rude.
 */
let identity: { at: number; value: BotIdentity | null } | null = null;
const IDENTITY_TTL = 60 * 60 * 1000;

export async function botIdentity(): Promise<BotIdentity | null> {
  if (identity && Date.now() - identity.at < IDENTITY_TTL) return identity.value;

  const response = await call<BotIdentity>("getMe");
  const value = response.ok && response.result ? response.result : null;
  identity = { at: Date.now(), value };
  return value;
}

/** The username, preferring what Telegram says over what someone typed. */
export async function botUsername(): Promise<string | null> {
  const me = await botIdentity();
  if (me?.username) return me.username;

  const configured = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  return configured ? configured.replace(/^@/, "") : null;
}

/**
 * The link that does the whole connection in one tap.
 *
 * `t.me/<bot>?start=<code>` opens the chat with a START button, and pressing
 * it sends `/start <code>` — so the founder never copies anything, never
 * pastes anything, and never has to work out which bot is ours. That last part
 * was the real problem: "send the code to the bot" is a useless instruction
 * when the reader does not know the bot's name.
 */
export async function connectLink(code: string): Promise<string | null> {
  const username = await botUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
}

export function webhookInfo(): Promise<TelegramResult<WebhookInfo>> {
  return call<WebhookInfo>("getWebhookInfo");
}

/**
 * Point Telegram at us.
 *
 * `drop_pending_updates` is on: a bot that has been sitting unregistered has a
 * backlog of every message anyone sent it, and delivering all of them the
 * instant the webhook goes live would replay old link codes and old approvals.
 *
 * `allowed_updates` is narrowed to messages. We do not use inline queries,
 * channel posts, polls or reactions, and accepting update types nothing reads
 * is bandwidth spent on a code path that does not exist.
 */
export async function registerWebhook(
  url: string,
): Promise<TelegramResult<boolean>> {
  const secret = webhookSecret();
  if (!secret) {
    return {
      ok: false,
      description:
        "No webhook secret is available. Set SECRETS_ENCRYPTION_KEY (the one the app already needs) and it derives one automatically, or set TELEGRAM_WEBHOOK_SECRET explicitly.",
    };
  }

  return call<boolean>("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export function deleteWebhook(): Promise<TelegramResult<boolean>> {
  return call<boolean>("deleteWebhook", { drop_pending_updates: false });
}

/**
 * Make sure Telegram is pointed at us, without anybody having to remember.
 *
 * Registering the webhook was a manual step, and a manual step that produces a
 * silent failure when skipped is a manual step that will be skipped. Worse, it
 * silently un-does itself: the URL is absolute, so moving to a custom domain,
 * or any redeploy that changes `NEXT_PUBLIC_APP_URL`, leaves Telegram
 * delivering to an address that no longer answers.
 *
 * So this is called on the path a founder takes to connect — checking is one
 * cheap API call, and registering only happens when the registered URL is
 * actually wrong. Throttled per process so a busy dashboard does not turn into
 * a getWebhookInfo loop.
 *
 * Returns what it did, for the caller's logs. Never throws: a founder opening
 * their dashboard must not see an error because Telegram was slow.
 */
let lastEnsure = 0;
const ENSURE_EVERY = 10 * 60 * 1000;

export async function ensureWebhook(
  expectedUrl: string | null,
): Promise<"skipped" | "ok" | "registered" | "failed"> {
  if (!expectedUrl || !botToken() || !webhookSecret()) return "skipped";
  if (Date.now() - lastEnsure < ENSURE_EVERY) return "skipped";
  lastEnsure = Date.now();

  try {
    const info = await webhookInfo();
    const registered = info.result?.url;
    const lastError = info.result?.last_error_message ?? "";

    // Re-register when the URL is wrong OR when Telegram's last delivery
    // failed. That second case is the one that was missing: a webhook pointing
    // at the right URL but registered with a stale or mismatched secret_token
    // delivers a 401/"Wrong response", and only a fresh setWebhook — which
    // rewrites the secret to the value this app actually checks and drops the
    // backlog — clears it. Once a delivery succeeds Telegram wipes the error,
    // so this cannot loop.
    const urlOk = registered === expectedUrl;
    const errored = /unauthorized|wrong response|401|403/i.test(lastError);
    if (urlOk && !errored) return "ok";

    const done = await registerWebhook(expectedUrl);
    if (done.ok) {
      console.warn(
        `[telegram] re-registered webhook (${
          !urlOk ? `was at ${registered ?? "nowhere"}` : `delivery error: ${lastError}`
        }) → ${expectedUrl}`,
      );
      return "registered";
    }

    console.error(`[telegram] could not register the webhook: ${done.description}`);
    return "failed";
  } catch {
    return "failed";
  }
}

/**
 * Turn model markdown into plain text Telegram can show.
 *
 * The bug this fixes: the agent wrote `**bold**`, `# headings` and em-dashes,
 * and because we send with no parse_mode those arrived literally — a founder
 * saw the asterisks and hashes. Rather than switch on Telegram's fragile
 * MarkdownV2 (which then needs everything escaped), we strip the formatting so
 * the message reads like a person typed it on their phone.
 */
export function toPlainText(input: string): string {
  return input
    .replace(/\r/g, "")
    // Bold/italic wrappers → their contents.
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1$2")
    // Inline code / code fences → their contents.
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/`([^`]+)`/g, "$1")
    // Leading markdown headers and blockquotes.
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    // Bullet markers to a simple dash.
    .replace(/^\s*[-*]\s+/gm, "- ")
    // Dashes people read as glitches on a phone.
    .replace(/[—–]/g, "-")
    // Any stray runs of asterisks or hashes left over.
    .replace(/\*{1,}/g, "")
    .replace(/#{1,}/g, "")
    // Collapse the blank-line pileups markdown leaves behind.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sends a message. Never throws — a failed send must not fail its caller. */
export async function sendMessage(
  chatId: string | number,
  text: string,
): Promise<boolean> {
  const response = await call<unknown>("sendMessage", {
    chat_id: chatId,
    // Always plain: the callers are the agent (markdown-happy) and our own
    // command replies (already plain, unaffected).
    text: toPlainText(text),
    disable_web_page_preview: true,
  });
  return response.ok;
}


/**
 * Send a text file as a document.
 *
 * Some answers are files, not messages. Five hundred leads pasted into a chat
 * bubble is unreadable and Telegram truncates it anyway, so the founder gets
 * something they can open in a spreadsheet instead.
 *
 * multipart/form-data rather than JSON, because sendDocument takes an upload.
 * Returns false rather than throwing — a failed file send should degrade to a
 * short message, not break the conversation.
 */
export async function sendDocument(
  chatId: number | string,
  filename: string,
  contents: string,
  caption?: string,
): Promise<boolean> {
  const token = botToken();
  if (!token) return false;

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([contents], { type: "text/csv" }), filename);
  if (caption) form.append("caption", toPlainText(caption).slice(0, 1024));

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
