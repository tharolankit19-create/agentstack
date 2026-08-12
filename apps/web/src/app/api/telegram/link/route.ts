import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireApiUser, requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { botUsername, connectLink, ensureWebhook } from "@/lib/telegram";
import { appUrl } from "@/lib/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Codes are short because they get typed into a phone. They expire fast for the same reason. */
const CODE_TTL_MINUTES = 15;

/**
 * Issues the one-time code that connects a Telegram chat to this account.
 *
 * The chat id is the credential once linked, so getting linked has to be
 * deliberate. A code that is shown only inside an authenticated dashboard,
 * expires in fifteen minutes, and is destroyed on use gives that without
 * making the founder configure anything.
 *
 * Six digits from `randomInt`, not `Math.random`: this is short-lived but it
 * is still a credential, and a predictable one is worth nothing.
 */
export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  // Self-healing. Registering the webhook used to be a manual step nobody knew
  // about, whose only symptom when skipped was a bot that never answered — and
  // it silently comes undone whenever the app's URL changes. Checking it here,
  // on the exact path a founder takes to connect, costs one throttled API call
  // and removes the failure entirely.
  const base = appUrl();
  await ensureWebhook(base ? `${base.replace(/\/+$/, "")}/api/telegram/webhook` : null);

  const admin = createAdminClient();
  const { data } = await admin
    .from("telegram_links")
    .select("chat_id, link_code, code_expires_at, linked_at")
    .eq("user_id", auth.session.userId)
    .maybeSingle<{
      chat_id: string | null;
      link_code: string | null;
      code_expires_at: string | null;
      linked_at: string | null;
    }>();

  const live =
    data?.link_code &&
    data.code_expires_at &&
    new Date(data.code_expires_at).getTime() > Date.now();

  const code = live ? (data?.link_code ?? null) : null;

  return NextResponse.json({
    connected: Boolean(data?.chat_id),
    linkedAt: data?.linked_at ?? null,
    // Never return an expired code — it would look usable and silently fail.
    code,
    expiresAt: live ? data?.code_expires_at : null,
    botUsername: await botUsername(),
    // The one-tap version. Telegram opens the right chat with a START button,
    // and pressing it sends the code — nothing to copy, and no need to know
    // which of the millions of bots is ours.
    connectUrl: code ? await connectLink(code) : null,
  });
}

export async function POST() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`tglink:${auth.session.userId}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many codes. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const code = String(randomInt(100_000, 1_000_000));
  const expires = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("telegram_links").upsert(
    {
      user_id: auth.session.userId,
      link_code: code,
      code_expires_at: expires,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[telegram] could not issue a link code:", error);
    return NextResponse.json({ error: "Could not create a code." }, { status: 500 });
  }

  return NextResponse.json({
    code,
    expiresAt: expires,
    minutes: CODE_TTL_MINUTES,
    botUsername: await botUsername(),
    connectUrl: await connectLink(code),
  });
}

/** Disconnects the chat. The code is cleared too, so nothing stale is left usable. */
export async function DELETE() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  await createAdminClient()
    .from("telegram_links")
    .update({
      chat_id: null,
      link_code: null,
      code_expires_at: null,
      linked_at: null,
    })
    .eq("user_id", auth.session.userId);

  return NextResponse.json({ ok: true });
}
