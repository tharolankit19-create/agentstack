/**
 * Credentials the platform supplies, so the customer never sees a field for
 * them.
 *
 * These are the ones where asking would be asking someone to do our job:
 * everybody's Telegram bot is the same bot, and it is ours. The founder links
 * to it by sending a code, and the deploy pipeline fills in the token and their
 * chat id from that link.
 *
 * Its own module, with no imports, on purpose. The deploy pipeline needs it and
 * so does the settings form — and the deploy pipeline reaches the service-role
 * Supabase client, so importing this constant from there would drag the admin
 * key into a browser bundle and fail the build.
 */
export const PLATFORM_SECRETS = new Set(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);

/** True for a key the customer must not be asked for. */
export function isPlatformSecret(key: string): boolean {
  return PLATFORM_SECRETS.has(key);
}
