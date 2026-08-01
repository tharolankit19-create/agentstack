import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/core/agent";
import { verifyAgentToken } from "@/core/auth";
import { isPaused } from "@/core/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(8_000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(60)
    .optional(),
  settings: z.record(z.string(), z.string()).optional(),
});

/**
 * Conversational entry point. Same loop as `/api/run`, but it returns only
 * what a chat UI needs and keeps the transcript on the caller's side — a
 * serverless function has nowhere durable to keep it anyway.
 */
export async function POST(request: Request) {
  const auth = verifyAgentToken(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (isPaused()) {
    return NextResponse.json(
      { error: "This agent is paused. Start it from your AgentStack dashboard." },
      { status: 409 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { message, history = [], settings } = parsed.data;
  const result = await runAgent({
    task: message,
    history: history.map((m) => ({ role: m.role, content: m.content })),
    settings,
    trigger: "chat",
  });

  return NextResponse.json(
    {
      ok: result.ok,
      reply: result.output || result.error || "The agent returned nothing.",
      generations: result.generations,
      usage: result.usage,
      runId: result.runId,
      error: result.error ?? null,
    },
    { status: result.ok ? 200 : 500 },
  );
}
