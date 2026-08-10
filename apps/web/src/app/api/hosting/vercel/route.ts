import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { connectVercel, disconnectVercel, hostingStatus } from "@/lib/user-hosting";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connect or disconnect the customer's own Vercel account.
 *
 * `requireApiUser`, not `requirePaidApiUser`: someone should be able to wire
 * up their hosting before they pay, so that the first thing after checkout is
 * a working deploy rather than another form.
 *
 * The token is validated against Vercel before it is stored, and the response
 * never contains it — only the account label, so the customer can see which
 * account is connected.
 */

const bodySchema = z.object({
  token: z.string().min(20).max(200),
  // Vercel team ids look like `team_xxx`. Blank means personal account.
  teamId: z.string().trim().max(100).optional(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json(hostingStatus(auth.session.profile));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  // Each attempt is a live call to Vercel, so it gets a budget.
  const limit = rateLimit(`hosting:${auth.session.userId}`, 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paste the whole token — it is about 24 characters." },
      { status: 400 },
    );
  }

  try {
    const status = await connectVercel(
      auth.session.userId,
      parsed.data.token.trim(),
      parsed.data.teamId?.trim() || null,
    );
    return NextResponse.json(status);
  } catch (cause) {
    // describeVercelToken's messages are written to be shown as-is.
    const message =
      cause instanceof Error ? cause.message : "Could not connect that account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  await disconnectVercel(auth.session.userId);
  return NextResponse.json({ ok: true });
}
