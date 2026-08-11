import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

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

  return NextResponse.json({
    connected: Boolean(data?.chat_id),
    linkedAt: data?.linked_at ?? null,
    // Never return an expired code — it would look usable and silently fail.
    code: live ? data?.link_code : null,
    expiresAt: live ? data?.code_expires_at : null,
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  });
}

export async function POST() {
  const auth = await requireApiUser();
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
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  });
}

/** Disconnects the chat. The code is cleared too, so nothing stale is left usable. */
export async function DELETE() {
  const auth = await requireApiUser();
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
