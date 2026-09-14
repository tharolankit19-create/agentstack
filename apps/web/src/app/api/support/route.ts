import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { chatComplete, chatKeyFor } from "@/lib/chat-model";
import { HEAD_AGENT } from "@/lib/army";
import type { SupportMessage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().min(1).max(4_000) });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`support:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many questions at once. Try again in a minute." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask something first." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: history }, { data: agents }, { data: head }] = await Promise.all([
    admin.from("support_messages").select("role, content").eq("user_id", auth.session.userId).order("created_at", { ascending: true }).limit(16),
    admin.from("agents").select("name, template_id, status, paused").eq("user_id", auth.session.userId).limit(30),
    admin.from("agents").select("id").eq("user_id", auth.session.userId).eq("template_id", HEAD_AGENT.id).maybeSingle<{ id: string }>(),
  ]);

  if (!head?.id) {
    return NextResponse.json({ error: "Kryx is still being set up. Refresh in a moment." }, { status: 503 });
  }

  const key = await chatKeyFor(head.id);
  if (!key) {
    return NextResponse.json({ error: "Kryx model pool is temporarily unavailable." }, { status: 503 });
  }

  const theirs = (agents ?? []).map((agent) => `- ${agent.name || agent.template_id}: ${agent.status}${agent.paused ? ", paused" : ""}`).join("\n") || "- No specialist agents yet";
  const system = `You are Kryx's in-product operator assistant. You help a founder use KryxAI quickly and correctly.

Current product truth:
- KryxAI is pay-as-you-go. No subscription is required.
- 100 credits = $1. Purchased credits do not expire.
- Kryx chat itself is free; specialist/data work can use credits.
- The founder talks to Kryx, the Head of Marketing. Specialists report to Kryx.
- Consequential actions such as publishing, outreach and spending require founder approval by default.
- Never ask the founder to add a Gemini key. Platform model routing already uses the configured provider pool and fallbacks.
- Never invent activity, leads, metrics, customers or integrations.

Founder: ${auth.session.profile.full_name || "unknown"}
Problems they selected: ${(auth.session.profile.problems ?? []).join(", ") || "not given"}
Their agents:
${theirs}

Answer in 1-4 short sentences unless steps are needed. Give the exact click path when useful. If the app cannot do something, say so plainly.`;

  const turns = [
    ...((history ?? []) as Pick<SupportMessage, "role" | "content">[]).map((turn) => ({ role: turn.role as "user" | "assistant", content: turn.content })),
    { role: "user" as const, content: parsed.data.message },
  ];

  try {
    const reply = await chatComplete(key, system, turns, HEAD_AGENT.id);
    await admin.from("support_messages").insert([
      { user_id: auth.session.userId, role: "user", content: parsed.data.message },
      { user_id: auth.session.userId, role: "assistant", content: reply },
    ]);
    return NextResponse.json({ reply });
  } catch (cause) {
    console.error("[support] failed:", cause);
    return NextResponse.json({ error: "Kryx could not answer right now. Try again in a moment." }, { status: 502 });
  }
}

export async function DELETE() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  await createAdminClient().from("support_messages").delete().eq("user_id", auth.session.userId);
  return NextResponse.json({ ok: true });
}
