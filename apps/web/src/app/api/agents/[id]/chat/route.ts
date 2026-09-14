import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatModelError, chatKeyFor, respondAsAgent, type ChatTurn } from "@/lib/chat-model";
import { executeHeadCommand } from "@/lib/head-orchestrator";
import { postFromAgent } from "@/lib/room";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent, ChatMessage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().trim().min(1).max(8_000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const limit = rateLimit(`chat:${auth.session.userId}`, 60, 3600);
  if (!limit.allowed) return NextResponse.json({ error: "That is a lot of messages this hour. Give it a minute." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Say something first." }, { status: 400 });

  const supabase = await createClient();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>();
  if (!agent || agent.user_id !== auth.session.userId) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (agent.paused) return NextResponse.json({ error: "This agent is paused. Resume it from Agents first." }, { status: 409 });
  const apiKey = await chatKeyFor(agent.id);
  if (!apiKey) return NextResponse.json({ error: "The model pool is not configured yet." }, { status: 409 });

  const admin = createAdminClient();
  const { data: history, error: historyError } = await admin.from("chat_messages").select("role, content").eq("agent_id", agent.id).eq("user_id", agent.user_id).order("created_at", { ascending: false }).limit(40);
  if (historyError) return NextResponse.json({ error: "Chat history is unavailable. No work was started." }, { status: 503 });
  const turns: ChatTurn[] = ((history ?? []) as Pick<ChatMessage, "role" | "content">[]).reverse().map((row) => ({ role: row.role, content: row.content }));
  turns.push({ role: "user", content: parsed.data.message });

  // Persist the founder's side before inference. If every provider is down the
  // conversation still exists when they return; failed inference must not look
  // like the founder never said it.
  const { error: saveError } = await admin.from("chat_messages").insert({ agent_id: agent.id, user_id: agent.user_id, role: "user", content: parsed.data.message });
  if (saveError) return NextResponse.json({ error: "Your message could not be saved. No work was started." }, { status: 503 });

  try {
    const command = await executeHeadCommand(agent, parsed.data.message);
    const reply = command.handled && command.reply ? command.reply : await respondAsAgent(agent, turns, apiKey);
    const { error: replyError } = await admin.from("chat_messages").insert({ agent_id: agent.id, user_id: agent.user_id, role: "assistant", content: reply });
    await postFromAgent(admin, agent.user_id, agent, reply, command.generationId).catch(() => undefined);
    await admin.from("agents").update({ last_run_at: new Date().toISOString() }).eq("id", agent.id);
    return NextResponse.json({ ok: !command.failed, reply, warning: replyError ? "This answer could not be saved to chat. Copy it before leaving." : undefined });
  } catch (cause) {
    if (cause instanceof ChatModelError) return NextResponse.json({ error: "The team is switching models. Try that message again in a moment." }, { status: 503 });
    console.error("[chat] failed:", cause);
    return NextResponse.json({ error: "The agent hit a temporary problem. Your message is saved." }, { status: 502 });
  }
}

