import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Evidence = z.object({
  kind: z.enum(["source", "fact", "file", "ui_receipt", "action_receipt", "metric", "error", "note"]),
  title: z.string().max(300).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  content: z.record(z.string(), z.unknown()).default({}),
});

const Body = z.object({
  nonce: z.string().uuid(),
  status: z.enum(["running", "waiting_for_user", "blocked", "verifying", "completed", "failed"]),
  output: z.record(z.string(), z.unknown()).optional(),
  evidence: z.array(Evidence).max(80).default([]),
  errorCode: z.string().max(120).optional(),
  errorMessage: z.string().max(2000).optional(),
  approval: z
    .object({
      actionType: z.string().min(1).max(120),
      target: z.string().max(500).optional(),
      description: z.string().min(1).max(1000),
      preview: z.record(z.string(), z.unknown()).default({}),
      riskLevel: z.union([z.literal(2), z.literal(3)]),
    })
    .optional(),
});

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function allowedEvidenceUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid device task update.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: task } = await admin
    .from("device_tasks")
    .select("*")
    .eq("id", id)
    .eq("device_id", auth.device.id)
    .eq("user_id", auth.device.userId)
    .maybeSingle();

  if (!task || task.nonce !== parsed.data.nonce) {
    return NextResponse.json({ error: "Task not found or replay nonce mismatched." }, { status: 404 });
  }

  if (["completed", "failed", "cancelled"].includes(task.status)) {
    return NextResponse.json({ error: "This task is already terminal." }, { status: 409 });
  }

  const allowedActions = new Set((task.allowed_actions ?? []) as string[]);
  for (const item of parsed.data.evidence) {
    if (item.kind !== "action_receipt") continue;
    const action = typeof item.content.action === "string" ? item.content.action : "";
    if (action && !allowedActions.has(action)) {
      return NextResponse.json(
        { error: `Device reported an action outside the signed task policy: ${action}` },
        { status: 409 },
      );
    }
  }

  if (parsed.data.status === "waiting_for_user" && !parsed.data.approval) {
    return NextResponse.json(
      { error: "waiting_for_user requires an explicit approval request." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const terminal = parsed.data.status === "completed" || parsed.data.status === "failed";

  const { data: changed } = await admin
    .from("device_tasks")
    .update({
      status: parsed.data.status,
      started_at: task.started_at ?? (parsed.data.status === "running" ? now : null),
      finished_at: terminal ? now : null,
      updated_at: now,
      error_code: parsed.data.errorCode ?? null,
      error_message: parsed.data.errorMessage ?? null,
    })
    .eq("id", task.id)
    .in("status", ["claimed", "running", "waiting_for_user", "blocked", "verifying"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (!changed) {
    return NextResponse.json({ error: "Task state changed before this update arrived." }, { status: 409 });
  }

  if (parsed.data.evidence.length) {
    const rows = parsed.data.evidence.map((item) => ({
      mission_id: task.mission_id,
      step_id: task.step_id,
      task_id: task.id,
      user_id: task.user_id,
      device_id: task.device_id,
      kind: item.kind,
      title: item.title ?? null,
      source_url: allowedEvidenceUrl(item.sourceUrl),
      content: item.content,
      content_sha256: sha256(item.content),
    }));
    await admin.from("task_evidence").insert(rows);
  }

  await admin.from("device_task_events").insert({
    task_id: task.id,
    mission_id: task.mission_id,
    user_id: task.user_id,
    device_id: task.device_id,
    event_type: "state",
    state: parsed.data.status,
    detail: {
      error_code: parsed.data.errorCode ?? null,
      evidence_count: parsed.data.evidence.length,
    },
  });

  if (parsed.data.approval) {
    await admin.from("action_approvals").insert({
      mission_id: task.mission_id,
      step_id: task.step_id,
      task_id: task.id,
      user_id: task.user_id,
      action_type: parsed.data.approval.actionType,
      target: parsed.data.approval.target ?? null,
      description: parsed.data.approval.description,
      preview: parsed.data.approval.preview,
      risk_level: parsed.data.approval.riskLevel,
      status: "pending",
    });
  }

  if (parsed.data.status === "completed") {
    await Promise.all([
      admin
        .from("hybrid_mission_steps")
        .update({
          status: "completed",
          output: parsed.data.output ?? {},
          finished_at: now,
        })
        .eq("id", task.step_id),
      admin
        .from("hybrid_missions")
        .update({ status: "running", updated_at: now })
        .eq("id", task.mission_id),
    ]);
  } else if (parsed.data.status === "failed") {
    await Promise.all([
      admin
        .from("hybrid_mission_steps")
        .update({
          status: "failed",
          output: parsed.data.output ?? null,
          error_code: parsed.data.errorCode ?? "device_task_failed",
          error_message: parsed.data.errorMessage ?? "Device task failed.",
          finished_at: now,
        })
        .eq("id", task.step_id),
      admin
        .from("hybrid_missions")
        .update({
          status: "failed",
          summary: parsed.data.errorMessage ?? "Device task failed.",
          finished_at: now,
          updated_at: now,
        })
        .eq("id", task.mission_id),
    ]);
  } else {
    await Promise.all([
      admin
        .from("hybrid_mission_steps")
        .update({
          status: parsed.data.status,
          output: parsed.data.output ?? undefined,
          error_code: parsed.data.errorCode ?? null,
          error_message: parsed.data.errorMessage ?? null,
        })
        .eq("id", task.step_id),
      admin
        .from("hybrid_missions")
        .update({
          status:
            parsed.data.status === "waiting_for_user"
              ? "waiting_for_user"
              : parsed.data.status === "blocked"
                ? "blocked"
                : "running",
          updated_at: now,
        })
        .eq("id", task.mission_id),
    ]);
  }

  return NextResponse.json(
    { ok: true, missionId: task.mission_id, state: parsed.data.status },
    { headers: { "Cache-Control": "no-store" } },
  );
}
