import { NextResponse } from "next/server";
import { requireOperatorApiUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;
  const limit = rateLimit(`voice-stt:${auth.session.userId}`, 60, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "Voice limit reached for this hour." }, { status: 429 });

  const apiKey = process.env.FISH_AUDIO_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Voice is not configured." }, { status: 409 });

  const incoming = await request.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "No voice note received." }, { status: 400 });
  if (audio.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Voice note is too large." }, { status: 413 });

  const form = new FormData();
  form.set("audio", audio, audio.name || "voice.webm");
  form.set("ignore_timestamps", "true");

  try {
    const response = await fetch("https://api.fish.audio/v1/asr", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { text?: string; message?: string };
    if (!response.ok || !payload.text?.trim()) {
      console.error("[voice/asr] Fish Audio failed", response.status, payload.message ?? "");
      return NextResponse.json({ error: "I couldn't understand that voice note." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, text: payload.text.trim() });
  } catch (cause) {
    console.error("[voice/asr] failed", cause);
    return NextResponse.json({ error: "Voice transcription is temporarily unavailable." }, { status: 502 });
  }
}
