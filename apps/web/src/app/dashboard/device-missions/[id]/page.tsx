import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MissionRetry } from "@/components/dashboard/mission-retry";

export const dynamic = "force-dynamic";

function prettyStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function evidenceContent(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 6000 ? text.slice(0, 6000) + "\n…" : text;
  } catch {
    return String(value ?? "");
  }
}

export default async function DeviceMissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUser();
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: mission }, { data: steps }, { data: evidence }, { data: approvals }] =
    await Promise.all([
      admin
        .from("hybrid_missions")
        .select("id, instruction, requested_execution, selected_device_id, status, summary, estimated_credits, credits_used, created_at, started_at, finished_at, updated_at")
        .eq("id", id)
        .eq("user_id", session.userId)
        .maybeSingle(),
      admin
        .from("hybrid_mission_steps")
        .select("id, ordinal, label, agent_template_id, execution, status, output, error_code, error_message, started_at, finished_at")
        .eq("mission_id", id)
        .eq("user_id", session.userId)
        .order("ordinal", { ascending: true }),
      admin
        .from("task_evidence")
        .select("id, kind, title, source_url, content, created_at")
        .eq("mission_id", id)
        .eq("user_id", session.userId)
        .order("created_at", { ascending: true })
        .limit(200),
      admin
        .from("action_approvals")
        .select("id, action_type, target, description, risk_level, status, created_at")
        .eq("mission_id", id)
        .eq("user_id", session.userId)
        .order("created_at", { ascending: true }),
    ]);

  if (!mission) notFound();

  const { data: device } = mission.selected_device_id
    ? await admin
        .from("devices")
        .select("device_name, platform, last_seen_at, revoked_at")
        .eq("id", mission.selected_device_id)
        .eq("user_id", session.userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-7">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-muted">
          <span className="rounded-full border border-line px-2 py-0.5">
            {prettyStatus(mission.status)}
          </span>
          <span>
            {device?.device_name ??
              (mission.requested_execution === "cloud" ? "Cloud" : "Auto")}
          </span>
        </div>
        <h1 className="mt-3 max-w-4xl text-3xl font-extrabold tracking-[-0.03em] text-fg-strong">
          {mission.instruction}
        </h1>
        {mission.summary ? (
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
            {mission.summary}
          </p>
        ) : null}
        {mission.status === "waiting_for_user" ? (
          <MissionRetry missionId={mission.id} />
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Execution</p>
          <p className="mt-2 text-[15px] font-bold text-fg-strong">
            {mission.requested_execution}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Credits</p>
          <p className="mt-2 text-[15px] font-bold text-fg-strong">
            {mission.credits_used} used
          </p>
          <p className="mt-1 text-[12px] text-faint">
            Estimate {mission.estimated_credits ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Evidence</p>
          <p className="mt-2 text-[15px] font-bold text-fg-strong">
            {(evidence ?? []).length} receipts
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-extrabold tracking-[-.025em] text-fg-strong">Execution</h2>
        <div className="mt-3 space-y-2">
          {(steps ?? []).map((step) => (
            <article key={step.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">
                    Step {step.ordinal + 1} · {step.execution}
                  </p>
                  <h3 className="mt-1 text-[15px] font-bold text-fg-strong">{step.label}</h3>
                  <p className="mt-1 text-[12px] text-muted">
                    {step.agent_template_id || "Local executor"}
                  </p>
                </div>
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {prettyStatus(step.status)}
                </span>
              </div>

              {step.error_message ? (
                <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 p-3 text-[12px] text-danger">
                  {step.error_message}
                </p>
              ) : null}

              {step.output ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-bg p-3 text-[11px] leading-relaxed text-muted">
                  {evidenceContent(step.output)}
                </pre>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {(approvals ?? []).length ? (
        <section>
          <h2 className="text-xl font-extrabold tracking-[-.025em] text-fg-strong">Approvals</h2>
          <div className="mt-3 space-y-2">
            {(approvals ?? []).map((approval) => (
              <article key={approval.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold text-fg-strong">
                    {approval.description}
                  </span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Level {approval.risk_level}
                  </span>
                  <span className="text-[11px] text-faint">{approval.status}</span>
                </div>
                {approval.target ? (
                  <p className="mt-1 text-[12px] text-muted">Target: {approval.target}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-extrabold tracking-[-.025em] text-fg-strong">Evidence</h2>
        <div className="mt-3 space-y-2">
          {(evidence ?? []).map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-faint">
                    {item.kind.replaceAll("_", " ")}
                  </p>
                  <h3 className="mt-1 text-[14px] font-bold text-fg-strong">
                    {item.title || "Evidence receipt"}
                  </h3>
                </div>
                {item.source_url ? (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-semibold text-accent hover:underline"
                  >
                    Open source
                  </a>
                ) : null}
              </div>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-bg p-3 text-[11px] leading-relaxed text-muted">
                {evidenceContent(item.content)}
              </pre>
            </article>
          ))}

          {!evidence?.length ? (
            <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] text-muted">
              No evidence has been recorded yet. Kryx will not call the mission finished just because a task started.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
