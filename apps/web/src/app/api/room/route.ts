import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser, requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleFounderMessage, loadRoom } from "@/lib/room";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().min(1).max(1000) });

/** The thread, for polling. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  try {
    const agentId = new URL(request.url).searchParams.get("agent") || undefined;
    return NextResponse.json({ messages: await loadRoom(admin, auth.session.userId, 100, agentId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The room could not be loaded. Please retry." }, { status: 503 });
  }
}

/**
 * The founder saying something in the room.
 *
 * An @mention runs that agent for real, so this can take as long as a run —
 * hence the generous maxDuration. The alternative is answering instantly with
 * "I'll look into it", which is the theatre this whole feature exists to avoid.
 */
export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  // A mention spends money, so this is limited like a run rather than a chat.
  const limit = rateLimit(`room:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Slow down a moment — that is a lot of jobs at once." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
  const reply = await handleFounderMessage(admin, auth.session.userId, parsed.data.text);

  return NextResponse.json({
    ok: true,
    answered: reply.answered,
    problem: reply.problem,
    messages: await loadRoom(admin, auth.session.userId),
  });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "The room request failed." }, { status: 503 });
  }
}
