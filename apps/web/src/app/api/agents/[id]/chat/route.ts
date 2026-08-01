import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentUnavailableError, callAgent } from "@/lib/agent-client";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent, ChatMessage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().min(1).max(8_000) });

/** Forwards one chat turn to the deployed agent and stores both sides. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const limit = rateLimit(`chat:${auth.session.userId}`, 60, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of messages this hour. Give it a minute." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const admin = createAdminClient();

  try {
    const result = await callAgent(agent, "/api/chat", {
      message: parsed.data.message,
      history: (history ?? []) as Pick<ChatMessage, "role" | "content">[],
      settings: agent.config ?? {},
    });

    await admin.from("chat_messages").insert([
      {
        agent_id: agent.id,
        user_id: agent.user_id,
        role: "user",
        content: parsed.data.message,
      },
      {
        agent_id: agent.id,
        user_id: agent.user_id,
        role: "assistant",
        content: result.reply,
      },
    ]);

    // Anything the agent produced in this turn belongs in the output list too,
    // so a draft written in chat is not lost when the tab closes.
    if (result.generations.length > 0) {
      await admin.from("generations").insert(
        result.generations.map((generation) => ({
          agent_id: agent.id,
          user_id: agent.user_id,
          kind: generation.kind,
          content: generation.content,
          meta: generation.meta ?? null,
        })),
      );
    }

    await admin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agent.id);

    return NextResponse.json({ ok: true, reply: result.reply });
  } catch (cause) {
    if (cause instanceof AgentUnavailableError) {
      return NextResponse.json({ error: cause.message }, { status: 409 });
    }
    console.error("[chat] failed:", cause);
    return NextResponse.json({ error: "The agent did not answer." }, { status: 502 });
  }
}
