import { NextResponse } from "next/server";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { signDeviceTaskPayload } from "@/lib/device-task-signing";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function capabilitiesSatisfied(required: string[], available: Record<string, unknown>): boolean {
  return required.every((name) => available[name] === true);
}

export async function GET(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const now = new Date();

  const { data: candidates, error } = await admin
    .from("device_tasks")
    .select("*")
    .eq("device_id", auth.device.id)
    .eq("user_id", auth.device.userId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(12);

  if (error) {
    return NextResponse.json({ error: "Could not read the device queue." }, { status: 500 });
  }

  for (const task of candidates ?? []) {
    if (Date.parse(task.expires_at) <= now.getTime()) {
      const finishedAt = now.toISOString();
      await Promise.all([
        admin
          .from("device_tasks")
          .update({
            status: "failed",
            error_code: "task_expired",
            error_message: "The device did not become available before this queued task expired.",
            finished_at: finishedAt,
            updated_at: finishedAt,
          })
          .eq("id", task.id)
          .eq("status", "queued"),
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "failed",
            error_code: "task_expired",
            error_message: "The device task expired before execution.",
            finished_at: finishedAt,
          })
          .eq("id", task.step_id),
        admin
          .from("hybrid_missions")
          .update({
            status: "failed",
            summary: "The selected device did not become available before the task expired.",
            finished_at: finishedAt,
            updated_at: finishedAt,
          })
          .eq("id", task.mission_id),
      ]);
      continue;
    }

    const required = (task.required_capabilities ?? []) as string[];
    if (!capabilitiesSatisfied(required, auth.device.capabilities)) {
      const missing = required.filter((name) => auth.device.capabilities[name] !== true);
      await Promise.all([
        admin
          .from("device_tasks")
          .update({
            status: "blocked",
            error_code: "capability_missing",
            error_message: `Missing device capabilities: ${missing.join(", ")}`,
            updated_at: now.toISOString(),
          })
          .eq("id", task.id)
          .eq("status", "queued"),
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "blocked",
            error_code: "capability_missing",
            error_message: `Missing device capabilities: ${missing.join(", ")}`,
          })
          .eq("id", task.step_id),
        admin
          .from("hybrid_missions")
          .update({
            status: "blocked",
            summary: `Selected device is missing: ${missing.join(", ")}`,
            updated_at: now.toISOString(),
          })
          .eq("id", task.mission_id),
      ]);
      continue;
    }

    const { data: step } = await admin
      .from("hybrid_mission_steps")
      .select("depends_on")
      .eq("id", task.step_id)
      .maybeSingle<{ depends_on: string[] | null }>();

    const dependencies = step?.depends_on ?? [];
    let dependencyContext: Array<{
      id: string;
      label: string;
      output: Record<string, unknown> | null;
    }> = [];

    if (dependencies.length) {
      const { data: depRows } = await admin
        .from("hybrid_mission_steps")
        .select("id, status, label, output")
        .in("id", dependencies);

      if (
        dependencies.some(
          (id) => !depRows?.some((dependency) => dependency.id === id && dependency.status === "completed"),
        )
      ) {
        continue;
      }

      dependencyContext = (depRows ?? []).map((dependency) => ({
        id: dependency.id,
        label: dependency.label,
        output:
          dependency.output &&
          typeof dependency.output === "object" &&
          !Array.isArray(dependency.output)
            ? (dependency.output as Record<string, unknown>)
            : null,
      }));
    }

    if (Number(task.risk_level ?? 1) >= 2) {
      const taskPayload =
        task.payload && typeof task.payload === "object" && !Array.isArray(task.payload)
          ? (task.payload as Record<string, unknown>)
          : {};
      const approvedAction =
        taskPayload.approved_action &&
        typeof taskPayload.approved_action === "object" &&
        !Array.isArray(taskPayload.approved_action)
          ? (taskPayload.approved_action as Record<string, unknown>)
          : null;
      const approvalId =
        typeof approvedAction?.approval_id === "string"
          ? approvedAction.approval_id
          : null;

      let approved = false;
      if (approvalId) {
        const { data: approval } = await admin
          .from("action_approvals")
          .select("id, status, task_id")
          .eq("id", approvalId)
          .eq("user_id", task.user_id)
          .eq("task_id", task.id)
          .maybeSingle<{ id: string; status: string; task_id: string | null }>();
        approved = approval?.status === "approved";
      }

      if (!approved) {
        const { data: existingApproval } = await admin
          .from("action_approvals")
          .select("id")
          .eq("task_id", task.id)
          .eq("user_id", task.user_id)
          .eq("status", "pending")
          .maybeSingle<{ id: string }>();

        if (!existingApproval) {
          const target =
            typeof taskPayload.app === "string"
              ? taskPayload.app
              : typeof taskPayload.target === "string"
                ? taskPayload.target
                : null;

          await admin.from("action_approvals").insert({
            mission_id: task.mission_id,
            step_id: task.step_id,
            task_id: task.id,
            user_id: task.user_id,
            requested_by: "kryx",
            action_type: task.task_type,
            target,
            description:
              task.task_type === "sheets.write"
                ? "Write the qualified lead results into Google Sheets"
                : `Allow Kryx to perform ${task.task_type}`,
            preview: {
              instruction: task.instruction,
              target,
              allowed_actions: task.allowed_actions ?? [],
              dependency_context: dependencyContext.map((dependency) => ({
                label: dependency.label,
                output:
                  typeof dependency.output?.content === "string"
                    ? dependency.output.content.slice(0, 5000)
                    : dependency.output,
              })),
            },
            risk_level: task.risk_level,
            status: "pending",
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        const waitingAt = new Date().toISOString();
        await Promise.all([
          admin
            .from("device_tasks")
            .update({
              status: "waiting_for_user",
              error_code: "approval_required",
              error_message: "Founder approval is required before this external action.",
              updated_at: waitingAt,
            })
            .eq("id", task.id)
            .eq("status", "queued"),
          admin
            .from("hybrid_mission_steps")
            .update({
              status: "waiting_for_user",
              error_code: "approval_required",
              error_message: "Founder approval is required before this external action.",
            })
            .eq("id", task.step_id),
          admin
            .from("hybrid_missions")
            .update({
              status: "waiting_for_user",
              summary: "An external action is ready for your approval.",
              updated_at: waitingAt,
            })
            .eq("id", task.mission_id),
        ]);

        continue;
      }
    }

    const claimedAt = now.toISOString();
    const { data: claimed } = await admin
      .from("device_tasks")
      .update({
        status: "claimed",
        claimed_at: claimedAt,
        attempt: task.attempt + 1,
        updated_at: claimedAt,
      })
      .eq("id", task.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (!claimed) continue;

    await Promise.all([
      admin
        .from("hybrid_mission_steps")
        .update({ status: "running", started_at: claimedAt })
        .eq("id", task.step_id),
      admin
        .from("hybrid_missions")
        .update({
          status: "running",
          started_at: claimedAt,
          updated_at: claimedAt,
        })
        .eq("id", task.mission_id),
      admin.from("device_task_events").insert({
        task_id: task.id,
        mission_id: task.mission_id,
        user_id: task.user_id,
        device_id: task.device_id,
        event_type: "claimed",
        state: "claimed",
        detail: { attempt: task.attempt + 1 },
      }),
    ]);

    const envelopeExpiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
    const payload = {
      version: 1,
      task_id: task.id,
      mission_id: task.mission_id,
      step_id: task.step_id,
      user_id: task.user_id,
      device_id: task.device_id,
      nonce: task.nonce,
      task_type: task.task_type,
      instruction: task.instruction,
      payload: task.payload ?? {},
      dependency_context: dependencyContext,
      required_capabilities: task.required_capabilities ?? [],
      allowed_actions: task.allowed_actions ?? [],
      risk_level: task.risk_level,
      attempt: task.attempt + 1,
      issued_at: now.toISOString(),
      expires_at: envelopeExpiresAt,
    };

    try {
      return NextResponse.json(
        { task: signDeviceTaskPayload(payload) },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Task signing failed.";
      await admin
        .from("device_tasks")
        .update({
          status: "queued",
          claimed_at: null,
          error_code: "signing_unavailable",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("status", "claimed");

      return NextResponse.json(
        { error: "Kryx task signing is not configured; no unsigned task was sent." },
        { status: 503 },
      );
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
