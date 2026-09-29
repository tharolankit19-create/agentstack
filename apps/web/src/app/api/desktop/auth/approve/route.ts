import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { hashToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({ requestId: z.string().uuid() });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid authorization request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("desktop_auth_requests")
    .select("id, state, redirect_uri, expires_at, consumed_at")
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string;
      state: string;
      redirect_uri: string;
      expires_at: string;
      consumed_at: string | null;
    }>();

  if (
    !pending ||
    pending.consumed_at ||
    Date.parse(pending.expires_at) <= Date.now() ||
    pending.redirect_uri !== "kryx://auth/callback"
  ) {
    return NextResponse.json({ error: "This desktop sign-in request expired." }, { status: 410 });
  }

  const code = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const { error } = await admin
    .from("desktop_auth_requests")
    .update({
      user_id: auth.session.userId,
      code_hash: hashToken(code),
      approved_at: now,
    })
    .eq("id", pending.id)
    .is("consumed_at", null);

  if (error) {
    console.error("[desktop/auth/approve] update failed", error);
    return NextResponse.json({ error: "Could not approve desktop sign-in." }, { status: 500 });
  }

  const callback = new URL(pending.redirect_uri);
  callback.searchParams.set("request", pending.id);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", pending.state);

  return NextResponse.json(
    { redirectUrl: callback.toString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
