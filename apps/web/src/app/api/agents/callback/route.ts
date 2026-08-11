import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/agent-auth";
import { recordLearnings } from "@/lib/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where deployed agents report their runs — and what they learned doing them.
 *
 * This endpoint is public — it has to be, the callers are other deployments.
 * What makes it safe is that an agent can only ever write rows for itself: the
 * agent id comes from a header, the token is checked against that agent's
 * stored hash, and every row written is stamped with that agent's own user id
 * from the database rather than anything in the request body.
 *
 * The `learnings` and `promptRevision` fields are the write half of the
 * self-improvement loop. They ride along on a request the agent was already
 * making rather than needing a second endpoint and a second auth surface, and
 * both are optional: an agent that reports neither still works exactly as it
 * did before they existed.
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

  /**
   * What this run concluded that the next one should not have to re-derive.
   *
   * Capped at ten. An agent reporting fifty "lessons" from one run has written
   * a summary, not learned fifty things, and letting that through fills the
   * memory with noise that then outranks the real lessons.
   */
  learnings: z
    .array(
      z.object({
        kind: z.enum(["worked", "failed", "audience", "competitor", "style", "fact"]),
        key: z.string().min(1).max(120),
        summary: z.string().min(1).max(600),
        score: z.number().min(-1).max(1).optional(),
      }),
    )
    .max(10)
    .optional(),

  /**
   * A rewrite the agent wants for one of its own prompts.
   *
   * Stored inactive. An agent may propose; a customer decides. A model that
   * can silently rewrite its own instructions has no stable behaviour and no
   * way back — a numbered revision somebody switched on has both.
   */
  promptRevision: z
    .object({
      name: z.string().min(1).max(60),
      body: z.string().min(1).max(20_000),
      reason: z.string().max(1_000).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const identity = await authenticateAgent(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const secretRow = { agent_id: identity.agentId, user_id: identity.userId };

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

  // What it learned. Only from runs that succeeded — a failed run's
  // conclusions were drawn from a broken execution, and remembering those is
  // how an agent teaches itself a lesson from its own bug.
  let learned = 0;
  if (report.ok && report.learnings?.length) {
    learned = await recordLearnings(secretRow.agent_id, report.learnings);
  }

  // A proposed rewrite of its own prompt. Filed, versioned, and inactive.
  let revision: number | null = null;
  if (report.ok && report.promptRevision) {
    const { data: latest } = await admin
      .from("agent_prompt_revisions")
      .select("version")
      .eq("agent_id", secretRow.agent_id)
      .eq("prompt_name", report.promptRevision.name)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number }>();

    const next = (latest?.version ?? 0) + 1;

    const { error: revisionError } = await admin
      .from("agent_prompt_revisions")
      .insert({
        user_id: secretRow.user_id,
        agent_id: secretRow.agent_id,
        prompt_name: report.promptRevision.name,
        body: report.promptRevision.body,
        reason: report.promptRevision.reason ?? null,
        version: next,
        active: false,
      });

    if (!revisionError) revision = next;
  }

  return NextResponse.json({ received: true, runId: run.id, learned, revision });
}
