import "server-only";

import { createAdminClient } from "./supabase/admin";
import { planHybridMission } from "./hybrid-planner";
import { runAgentOnce } from "./run-agent";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

type RequestedExecution = "auto" | "cloud" | "macos" | "android";

function enabledCapabilityNames(capabilities: Record<string, unknown> | null | undefined): Set<string> {
  return new Set(
    Object.entries(capabilities ?? {})
      .filter(([, value]) => value === true)
      .map(([key]) => key),
  );
}

function missingCapabilities(
  required: string[],
  available: Record<string, unknown> | null | undefined,
): string[] {
  const enabled = enabledCapabilityNames(available);
  return required.filter((capability) => !enabled.has(capability));
}

export async function createHybridMission(
  admin: Admin,
  input: {
    userId: string;
    instruction: string;
    requestedExecution: RequestedExecution;
    selectedDeviceId?: string | null;
  },
): Promise<{ missionId: string; status: string; missingCapabilities: string[] }> {
  const plan = planHybridMission(input.instruction, input.requestedExecution);
  const deviceSteps = plan.steps.filter((step) => step.execution === "device");

  let device:
    | {
        id: string;
        platform: string;
        status: string;
        revoked_at: string | null;
        capabilities: Record<string, unknown> | null;
      }
    | null = null;

  if (deviceSteps.length) {
    if (!input.selectedDeviceId) {
      const { data: autoDevice } = await admin
        .from("devices")
        .select("id, platform, status, revoked_at, capabilities")
        .eq("user_id", input.userId)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      device = autoDevice ?? null;
    } else {
      const { data: selected } = await admin
        .from("devices")
        .select("id, platform, status, revoked_at, capabilities")
        .eq("id", input.selectedDeviceId)
        .eq("user_id", input.userId)
        .is("revoked_at", null)
        .maybeSingle();

      device = selected ?? null;
    }
  }

  const allRequired = [...new Set(deviceSteps.flatMap((step) => step.requiredCapabilities))];
  const missing = device ? missingCapabilities(allRequired, device.capabilities) : allRequired;

  let initialStatus = "queued";
  if (deviceSteps.length && !device) initialStatus = "waiting_for_device";
  else if (deviceSteps.length && missing.length) initialStatus = "blocked";
  else if (deviceSteps.length) initialStatus = "waiting_for_device";

  const { data: mission, error: missionError } = await admin
    .from("hybrid_missions")
    .insert({
      user_id: input.userId,
      instruction: input.instruction,
      requested_execution: input.requestedExecution,
      selected_device_id: device?.id ?? null,
      status: initialStatus,
      planner: {
        squad: plan.squad,
        step_count: plan.steps.length,
        missing_capabilities: missing,
      },
      estimated_credits: plan.estimatedCredits,
    })
    .select("id")
    .single<{ id: string }>();

  if (missionError || !mission) {
    throw new Error(missionError?.message ?? "Could not create Kryx mission.");
  }

  let previousStepId: string | null = null;

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const stepMissing =
      step.execution === "device"
        ? device
          ? missingCapabilities(step.requiredCapabilities, device.capabilities)
          : step.requiredCapabilities
        : [];

    const stepStatus =
      step.execution === "device" && (!device || stepMissing.length)
        ? !device
          ? "waiting_for_device"
          : "blocked"
        : "queued";

    const stepInsert = await admin
      .from("hybrid_mission_steps")
      .insert({
        mission_id: mission.id,
        user_id: input.userId,
        ordinal: index,
        agent_template_id: step.agentTemplateId,
        label: step.label,
        execution: step.execution,
        required_capabilities: step.requiredCapabilities,
        status: stepStatus,
        depends_on: previousStepId ? [previousStepId] : [],
        input: {
          ...(step.input ?? {}),
          founder_instruction: input.instruction,
          missing_capabilities: stepMissing,
          _device:
            step.execution === "device"
              ? {
                  task_type: step.taskType ?? "device.generic",
                  allowed_actions: step.allowedActions ?? [],
                  risk_level: step.riskLevel ?? 1,
                }
              : null,
        },
      })
      .select("id")
      .single();

    const insertedStep = stepInsert.data as { id: string } | null;
    const stepError = stepInsert.error;

    if (stepError || !insertedStep) {
      await admin
        .from("hybrid_missions")
        .update({
          status: "failed",
          summary: stepError?.message ?? "Could not persist mission plan.",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mission.id);
      throw new Error(stepError?.message ?? "Could not persist mission step.");
    }

    if (step.execution === "device" && device && stepMissing.length === 0) {
      const { error: taskError } = await admin.from("device_tasks").insert({
        mission_id: mission.id,
        step_id: insertedStep.id,
        user_id: input.userId,
        device_id: device.id,
        task_type: step.taskType ?? "device.generic",
        instruction: input.instruction,
        payload: step.input ?? {},
        required_capabilities: step.requiredCapabilities,
        allowed_actions: step.allowedActions ?? [],
        risk_level: step.riskLevel ?? 1,
      });

      if (taskError) {
        await admin
          .from("hybrid_mission_steps")
          .update({
            status: "failed",
            error_code: "task_create_failed",
            error_message: taskError.message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", insertedStep.id);

        await admin
          .from("hybrid_missions")
          .update({
            status: "failed",
            summary: taskError.message,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", mission.id);

        throw new Error(taskError.message);
      }
    }

    previousStepId = insertedStep.id;
  }

  return { missionId: mission.id, status: initialStatus, missingCapabilities: missing };
}

async function previousContext(
  admin: Admin,
  missionId: string,
  ordinal: number,
): Promise<string> {
  const { data } = await admin
    .from("hybrid_mission_steps")
    .select("ordinal, label, output")
    .eq("mission_id", missionId)
    .lt("ordinal", ordinal)
    .eq("status", "completed")
    .order("ordinal", { ascending: true });

  const compact = (data ?? []).map((row) => ({
    step: row.ordinal,
    label: row.label,
    output: row.output,
  }));

  const raw = JSON.stringify(compact);
  return raw.length <= 12_000 ? raw : raw.slice(0, 12_000) + "…";
}

/**
 * Advance cloud-only steps after device work lands.
 *
 * One step per mission per pass prevents a single mission from monopolising the
 * cron worker and makes failures resumable at a clean boundary.
 */
export async function advanceHybridMissions(
  admin: Admin,
  limit = 12,
  missionId?: string,
): Promise<{ considered: number; advanced: number; completed: number; failed: number }> {
  let missionQuery = admin
    .from("hybrid_missions")
    .select("id, user_id, instruction, status, selected_device_id")
    .in("status", ["queued", "running", "verifying"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (missionId) missionQuery = missionQuery.eq("id", missionId);

  const { data: missions } = await missionQuery;

  let advanced = 0;
  let completed = 0;
  let failed = 0;

  for (const mission of missions ?? []) {
    const { data: steps } = await admin
      .from("hybrid_mission_steps")
      .select("*")
      .eq("mission_id", mission.id)
      .order("ordinal", { ascending: true });

    const ordered = steps ?? [];
    if (!ordered.length) continue;

    const firstIncomplete = ordered.find((step) => step.status !== "completed");

    if (!firstIncomplete) {
      const last = ordered[ordered.length - 1];
      await admin
        .from("hybrid_missions")
        .update({
          status: "completed",
          summary:
            typeof last.output?.content === "string"
              ? last.output.content.slice(0, 2000)
              : "Mission completed with evidence.",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", mission.id);
      completed += 1;
      continue;
    }

    if (
      ["running", "waiting_for_device", "waiting_for_user", "blocked", "failed", "cancelled"].includes(
        firstIncomplete.status,
      )
    ) {
      continue;
    }

    const dependencies = new Set<string>(firstIncomplete.depends_on ?? []);
    const depsDone = [...dependencies].every((id) =>
      ordered.some((step) => step.id === id && step.status === "completed"),
    );
    if (!depsDone) continue;

    if (firstIncomplete.execution === "device") {
      // Device queue owns this step. Keep the mission waiting/running.
      continue;
    }

    const { data: agent } = await admin
      .from("agents")
      .select("*")
      .eq("user_id", mission.user_id)
      .eq("template_id", firstIncomplete.agent_template_id)
      .maybeSingle<Agent>();

    if (!agent) {
      const message = `Required Kryx agent is not deployed: ${firstIncomplete.agent_template_id}`;
      await Promise.all([
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "failed",
            error_code: "agent_missing",
            error_message: message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", firstIncomplete.id),
        admin
          .from("hybrid_missions")
          .update({
            status: "failed",
            summary: message,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", mission.id),
      ]);
      failed += 1;
      continue;
    }

    const claimedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("hybrid_mission_steps")
      .update({ status: "running", started_at: claimedAt })
      .eq("id", firstIncomplete.id)
      .eq("status", "queued")
      .select("id");

    if (!claimed?.length) continue;

    await admin
      .from("hybrid_missions")
      .update({
        status: "running",
        started_at: mission.status === "queued" ? claimedAt : undefined,
        updated_at: claimedAt,
      })
      .eq("id", mission.id);

    try {
      const context = await previousContext(admin, mission.id, firstIncomplete.ordinal);
      const stepInput =
        firstIncomplete.input &&
        typeof firstIncomplete.input === "object" &&
        !Array.isArray(firstIncomplete.input)
          ? (firstIncomplete.input as Record<string, unknown>)
          : {};
      const outputContract =
        typeof stepInput.output_contract === "string"
          ? stepInput.output_contract
          : "";

      const instruction = [
        `Founder goal: ${mission.instruction}`,
        `Your squad step: ${firstIncomplete.label}`,
        context !== "[]" ? `Verified prior step output/evidence: ${context}` : "",
        outputContract ? `Output contract: ${outputContract}` : "",
        "Do this step now. Do not claim external actions you did not actually perform. Preserve useful sources and concrete facts.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await runAgentOnce(admin, agent, {
        instruction,
        label: firstIncomplete.label,
        announce: true,
      });

      if (!result.ok || !result.content) {
        throw new Error(result.reason ?? "The Kryx agent did not return a usable result.");
      }

      const finishedAt = new Date().toISOString();
      await admin
        .from("hybrid_mission_steps")
        .update({
          status: "completed",
          output: { content: result.content },
          finished_at: finishedAt,
        })
        .eq("id", firstIncomplete.id);

      await admin.from("task_evidence").insert({
        mission_id: mission.id,
        step_id: firstIncomplete.id,
        user_id: mission.user_id,
        device_id: mission.selected_device_id,
        kind: "note",
        title: firstIncomplete.label,
        content: { content: result.content, source: "cloud_agent" },
      });

      await admin
        .from("hybrid_missions")
        .update({ status: "running", updated_at: finishedAt })
        .eq("id", mission.id);

      advanced += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Cloud step failed.";
      const finishedAt = new Date().toISOString();
      await Promise.all([
        admin
          .from("hybrid_mission_steps")
          .update({
            status: "failed",
            error_code: "cloud_step_failed",
            error_message: message,
            finished_at: finishedAt,
          })
          .eq("id", firstIncomplete.id),
        admin
          .from("hybrid_missions")
          .update({
            status: "failed",
            summary: message,
            finished_at: finishedAt,
            updated_at: finishedAt,
          })
          .eq("id", mission.id),
      ]);
      failed += 1;
    }
  }

  return {
    considered: (missions ?? []).length,
    advanced,
    completed,
    failed,
  };
}


/**
 * Re-evaluate device steps after a heartbeat changes local capabilities.
 *
 * A mission created while Accessibility/browser control was off should recover
 * when the founder grants that permission; it should not require deleting and
 * recreating the mission.
 */
export async function reconcileDeviceMissions(
  admin: Admin,
  input: {
    userId: string;
    deviceId: string;
    capabilities: Record<string, unknown>;
  },
): Promise<number> {
  const { data: missions } = await admin
    .from("hybrid_missions")
    .select("id, instruction, status")
    .eq("user_id", input.userId)
    .eq("selected_device_id", input.deviceId)
    .in("status", ["blocked", "waiting_for_device", "queued", "running"])
    .order("created_at", { ascending: true })
    .limit(50);

  let recovered = 0;

  for (const mission of missions ?? []) {
    const { data: steps } = await admin
      .from("hybrid_mission_steps")
      .select("id, execution, required_capabilities, status, input")
      .eq("mission_id", mission.id)
      .eq("user_id", input.userId)
      .eq("execution", "device")
      .in("status", ["blocked", "waiting_for_device", "queued"]);

    for (const step of steps ?? []) {
      const required = (step.required_capabilities ?? []) as string[];
      const missing = missingCapabilities(required, input.capabilities);
      if (missing.length) continue;

      const { data: existingTask } = await admin
        .from("device_tasks")
        .select("id, status")
        .eq("step_id", step.id)
        .maybeSingle<{ id: string; status: string }>();

      if (existingTask) {
        if (existingTask.status === "blocked") {
          await admin
            .from("device_tasks")
            .update({
              status: "queued",
              error_code: null,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingTask.id)
            .eq("status", "blocked");
        }

        await admin
          .from("hybrid_mission_steps")
          .update({
            status: "queued",
            error_code: null,
            error_message: null,
          })
          .eq("id", step.id)
          .in("status", ["blocked", "waiting_for_device"]);

        recovered += 1;
        continue;
      }

      const stepInput =
        step.input && typeof step.input === "object" && !Array.isArray(step.input)
          ? (step.input as Record<string, unknown>)
          : {};
      const devicePolicy =
        stepInput._device &&
        typeof stepInput._device === "object" &&
        !Array.isArray(stepInput._device)
          ? (stepInput._device as Record<string, unknown>)
          : null;

      if (!devicePolicy) continue;

      const taskType =
        typeof devicePolicy.task_type === "string"
          ? devicePolicy.task_type
          : "device.generic";
      const allowedActions = Array.isArray(devicePolicy.allowed_actions)
        ? devicePolicy.allowed_actions.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const riskLevel =
        devicePolicy.risk_level === 2 || devicePolicy.risk_level === 3
          ? devicePolicy.risk_level
          : 1;

      const publicPayload = { ...stepInput };
      delete publicPayload._device;
      delete publicPayload.missing_capabilities;

      const { error } = await admin.from("device_tasks").insert({
        mission_id: mission.id,
        step_id: step.id,
        user_id: input.userId,
        device_id: input.deviceId,
        task_type: taskType,
        instruction: mission.instruction,
        payload: publicPayload,
        required_capabilities: required,
        allowed_actions: allowedActions,
        risk_level: riskLevel,
      });

      if (!error) {
        await admin
          .from("hybrid_mission_steps")
          .update({
            status: "queued",
            error_code: null,
            error_message: null,
            input: {
              ...stepInput,
              missing_capabilities: [],
            },
          })
          .eq("id", step.id);
        recovered += 1;
      }
    }

    if (recovered > 0) {
      await admin
        .from("hybrid_missions")
        .update({
          status: "waiting_for_device",
          summary: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mission.id)
        .in("status", ["blocked", "waiting_for_device"]);
    }
  }

  return recovered;
}
