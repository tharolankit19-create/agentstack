import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceRequest } from "@/lib/desktop-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Event = z.object({
  observedAt: z.string().datetime(),
  appId: z.string().min(1).max(240),
  windowClass: z.string().max(300).optional(),
  eventType: z.string().min(1).max(120),
  domain: z.string().max(300).optional(),
  elementRole: z.string().max(180).optional(),
});

const Body = z.object({
  events: z.array(Event).min(1).max(100),
});

function sequenceFingerprint(events: z.infer<typeof Event>[]): {
  fingerprint: string;
  title: string;
  steps: Array<{ app: string; event: string }>;
} | null {
  const compact: Array<{ app: string; event: string }> = [];

  for (const event of events) {
    const key = `${event.appId}:${event.eventType}`;
    const previous = compact.at(-1);
    if (previous && `${previous.app}:${previous.event}` === key) continue;
    compact.push({ app: event.appId, event: event.eventType });
  }

  if (compact.length < 3) return null;
  const steps = compact.slice(-6);
  const canonical = steps.map((step) => `${step.app}>${step.event}`).join("|");
  const fingerprint = createHash("sha256").update(canonical).digest("hex");
  const apps = [...new Set(steps.map((step) => step.app))];

  return {
    fingerprint,
    title: apps.length > 1 ? `${apps.slice(0, 3).join(" → ")} workflow` : `${apps[0]} routine`,
    steps,
  };
}

export async function POST(request: Request) {
  const auth = await verifyDeviceRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Observer event batch.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("observer_settings")
    .select("enabled, excluded_apps")
    .eq("device_id", auth.device.id)
    .eq("user_id", auth.device.userId)
    .maybeSingle<{ enabled: boolean; excluded_apps: string[] | null }>();

  if (!settings?.enabled) {
    return NextResponse.json({ error: "Observer Mode is not enabled for this device." }, { status: 409 });
  }

  const excluded = new Set(settings.excluded_apps ?? []);
  const sanitized = parsed.data.events
    .filter((event) => !excluded.has(event.appId))
    .map((event) => ({
      user_id: auth.device.userId,
      device_id: auth.device.id,
      observed_at: event.observedAt,
      app_id: event.appId,
      window_class: event.windowClass ?? null,
      event_type: event.eventType,
      domain: event.domain ?? null,
      element_role: event.elementRole ?? null,
      meta: {},
    }));

  if (!sanitized.length) {
    return NextResponse.json({ accepted: 0, workflowDetected: false });
  }

  const { error } = await admin.from("device_observations").insert(sanitized);
  if (error) {
    return NextResponse.json({ error: "Could not store sanitized Observer events." }, { status: 500 });
  }

  const candidate = sequenceFingerprint(
    parsed.data.events.filter((event) => !excluded.has(event.appId)),
  );
  let workflowDetected = false;

  if (candidate) {
    const now = new Date().toISOString();
    const { data: existing } = await admin
      .from("detected_workflows")
      .select("id, occurrences, status, mode, shadow_runs, confidence")
      .eq("user_id", auth.device.userId)
      .eq("device_id", auth.device.id)
      .eq("fingerprint", candidate.fingerprint)
      .maybeSingle<{
        id: string;
        occurrences: number;
        status: string;
        mode: string;
        shadow_runs: number;
        confidence: number | string | null;
      }>();

    if (existing) {
      const occurrences = existing.occurrences + 1;
      const confidence = Math.min(0.95, 0.4 + occurrences * 0.1);
      const patch: Record<string, unknown> = {
        occurrences,
        confidence,
        last_seen_at: now,
        steps: candidate.steps,
      };

      if (existing.mode === "shadow") {
        const proposed = candidate.steps.map((step, index) => ({
          ordinal: index + 1,
          app: step.app,
          observed_event: step.event,
          proposed_method:
            step.app === "com.google.Chrome" || step.app === "com.android.chrome"
              ? "structured_browser_or_accessibility"
              : "accessibility_or_native_app_control",
          approval:
            step.event === "clicked"
              ? "depends_on_target_action"
              : "not_required_for_observation_or_navigation",
        }));

        patch.shadow_runs = (existing.shadow_runs ?? 0) + 1;
        patch.last_shadow_result = {
          captured_at: now,
          observed_steps: candidate.steps,
          proposed_execution: proposed,
          confidence,
          note:
            "Shadow Mode generated this plan from sanitized app/domain/action metadata only. No external action was executed.",
        };
      }

      await admin
        .from("detected_workflows")
        .update(patch)
        .eq("id", existing.id);

      workflowDetected = existing.status === "detected" && occurrences >= 3;
    } else {
      await admin.from("detected_workflows").insert({
        user_id: auth.device.userId,
        device_id: auth.device.id,
        fingerprint: candidate.fingerprint,
        title: candidate.title,
        steps: candidate.steps,
        occurrences: 1,
        confidence: 0.5,
        status: "detected",
        first_seen_at: now,
        last_seen_at: now,
      });
    }
  }

  return NextResponse.json({
    accepted: sanitized.length,
    workflowDetected,
  });
}
