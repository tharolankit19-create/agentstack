import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { synthesizeVoice } from "@/lib/fish-audio";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ text: z.string().min(1).max(6_000) });

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`voice:${auth.session.userId}`, 60, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Voice limit reached for this hour." }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  try {
    const audio = await synthesizeVoice(parsed.data.text);
    return new Response(audio.bytes, {
      status: 200,
      headers: {
        "content-type": audio.contentType,
        "cache-control": "private, no-store",
        "content-disposition": "inline; filename=seamus.mp3",
      },
    });
  } catch (cause) {
    console.error("[voice/tts] failed", cause);
    return NextResponse.json({ error: "Voice is temporarily unavailable." }, { status: 502 });
  }
}
