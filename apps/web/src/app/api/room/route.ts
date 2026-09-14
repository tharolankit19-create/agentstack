import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleFounderMessage, loadRoom } from "@/lib/room";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ text: z.string().min(1).max(1000) });

export async function GET() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  return NextResponse.json({ messages: await loadRoom(admin, auth.session.userId) });
}

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`room:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Slow down a moment — that is a lot of jobs at once." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Say something first." }, { status: 400 });

  const admin = createAdminClient();
  const reply = await handleFounderMessage(admin, auth.session.userId, parsed.data.text);
  const messages = await loadRoom(admin, auth.session.userId);

  return NextResponse.json({
    ok: true,
    answered: reply.answered,
    problem: reply.problem,
    reply: reply.reply,
    templateId: reply.templateId,
    ...(messages.length ? { messages } : {}),
  });
}
