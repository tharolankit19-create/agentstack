import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ChatModelError,
  chatComplete,
  modelKeyFor,
  systemPromptFor,
  type ChatTurn,
} from "@/lib/chat-model";
import { rateLimit } from "@/lib/rate-limit";
import type { Agent, ChatMessage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().min(1).max(8_000) });

/**
 * One chat turn with an agent, run on the server.
 *
 * This calls the model directly with the founder's own key rather than
 * proxying to the agent's deployed URL. That removes the whole class of "the
 * agent returned HTTP 401" failures — chatting no longer needs the agent to be
 * deployed, reachable, or holding a matching token. You can talk to your head
 * agent the moment it exists.
 */
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

  const apiKey = await modelKeyFor(agent.id);
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "This agent has no model key yet. Add one in Settings and it goes to the whole army.",
      },
      { status: 409 },
    );
  }

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true })
    .limit(20);

  const turns: ChatTurn[] = ((history ?? []) as Pick<
    ChatMessage,
    "role" | "content"
  >[]).map((row) => ({ role: row.role, content: row.content }));
  turns.push({ role: "user", content: parsed.data.message });

  const admin = createAdminClient();

  try {
    const system = await systemPromptFor(agent);
    const reply = await chatComplete(apiKey, system, turns);

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
        content: reply,
      },
    ]);

    await admin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agent.id);

    return NextResponse.json({ ok: true, reply });
  } catch (cause) {
    if (cause instanceof ChatModelError) {
      // A real, actionable message — key rejected, model missing, rate-limited.
      return NextResponse.json({ error: cause.message }, { status: 502 });
    }
    console.error("[chat] failed:", cause);
    return NextResponse.json(
      { error: "Something went wrong talking to the model." },
      { status: 502 },
    );
  }
}
