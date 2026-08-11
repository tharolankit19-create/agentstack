import "server-only";

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

export function webhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
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
        "TELEGRAM_WEBHOOK_SECRET is not set. Without it the webhook route rejects every update, so registering would produce a bot that still does not reply.",
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

/** Sends a message. Never throws — a failed send must not fail its caller. */
export async function sendMessage(
  chatId: string | number,
  text: string,
): Promise<boolean> {
  const response = await call<unknown>("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  return response.ok;
}
