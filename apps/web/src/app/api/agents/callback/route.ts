import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenMatchesHash } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where deployed agents report their runs.
 *
 * This endpoint is public — it has to be, the callers are other deployments.
 * What makes it safe is that an agent can only ever write rows for itself: the
 * agent id comes from a header, the token is checked against that agent's
 * stored hash, and every row written is stamped with that agent's own user id
 * from the database rather than anything in the request body.
 */

const bodySchema = z.object({
  agentId: z.string().uuid(),
  runId: z.string().max(120),
  templateId: z.string().max(60).optional(),
  trigger: z.string().max(30).optional(),
  ok: z.boolean(),
  error: z.string().max(4_000).nullable().optional(),
  output: z.string().max(200_000).optional(),
  generations: z
    .array(
      z.object({
        kind: z.string().max(40),
        content: z.string().max(20_000),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(100)
    .optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  iterations: z.number().int().optional(),
  toolCalls: z.number().int().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
});

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const agentIdHeader = request.headers.get("x-agent-id") ?? "";

  if (!token || !agentIdHeader) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: secretRow } = await admin
    .from("agent_secrets")
    .select("agent_id, user_id, agent_token_hash")
    .eq("agent_id", agentIdHeader)
    .maybeSingle<{
      agent_id: string;
      user_id: string;
      agent_token_hash: string | null;
    }>();

  if (!secretRow?.agent_token_hash || !tokenMatchesHash(token, secretRow.agent_token_hash)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid run report." }, { status: 400 });
  }

  const report = parsed.data;

  // The body could claim any agent id. Only the authenticated one is used.
  if (report.agentId !== secretRow.agent_id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .upsert(
      {
        agent_id: secretRow.agent_id,
        user_id: secretRow.user_id,
        external_run_id: report.runId,
        trigger: report.trigger ?? "schedule",
        status: report.ok ? "succeeded" : "failed",
        output: report.output ?? null,
        error: report.error ?? null,
        usage: report.usage ?? null,
        iterations: report.iterations ?? null,
        tool_calls: report.toolCalls ?? null,
        started_at: report.startedAt ?? new Date().toISOString(),
        finished_at: report.finishedAt ?? new Date().toISOString(),
      },
      { onConflict: "agent_id,external_run_id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (runError) {
    console.error("[callback] could not record run:", runError);
    return NextResponse.json({ error: "Storage failed." }, { status: 500 });
  }

  if (report.generations?.length) {
    const { error: generationError } = await admin.from("generations").insert(
      report.generations.map((generation) => ({
        agent_id: secretRow.agent_id,
        user_id: secretRow.user_id,
        run_id: run.id,
        kind: generation.kind,
        content: generation.content,
        meta: generation.meta ?? null,
      })),
    );
    if (generationError) {
      console.error("[callback] could not record generations:", generationError);
    }
  }

  await admin
    .from("agents")
    .update({
      last_run_at: report.finishedAt ?? new Date().toISOString(),
      ...(report.ok ? { last_error: null } : { last_error: report.error ?? null }),
    })
    .eq("id", secretRow.agent_id);

  return NextResponse.json({ received: true, runId: run.id });
}
