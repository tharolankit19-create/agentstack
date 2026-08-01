import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/core/agent";
import { verifyAgentToken } from "@/core/auth";
import { reportRun } from "@/core/telemetry";
import { isPaused } from "@/core/scheduler";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  task: z.string().min(1).max(8_000),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string(),
        tool_call_id: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .max(100)
    .optional(),
  settings: z.record(z.string(), z.string()).optional(),
  trigger: z.enum(["manual", "schedule", "chat"]).optional(),
  maxIterations: z.number().int().min(1).max(20).optional(),
});

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

  const result = await runAgent(parsed.data);
  await reportRun(result);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
