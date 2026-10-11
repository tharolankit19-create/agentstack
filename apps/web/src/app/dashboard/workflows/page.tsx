import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkflowDecision } from "@/components/dashboard/workflow-decision";

export const dynamic = "force-dynamic";

function prettyApp(value: string): string {
  const known: Record<string, string> = {
    "com.android.chrome": "Chrome",
    "com.google.android.gm": "Gmail",
    "com.google.android.apps.docs.editors.sheets": "Google Sheets",
    "com.twitter.android": "X",
    "com.linkedin.android": "LinkedIn",
    "notion.id": "Notion",
    "com.Slack": "Slack",
    "org.telegram.messenger": "Telegram",
  };
  return known[value] ?? value;
}

export default async function WorkflowsPage() {
  const session = await requireUser("/dashboard/workflows");
  const admin = createAdminClient();

  const { data: workflows } = await admin
    .from("detected_workflows")
    .select("id, title, steps, occurrences, confidence, status, mode, first_seen_at, last_seen_at, shadow_runs, last_shadow_result")
    .eq("user_id", session.userId)
    .neq("status", "archived")
    .order("last_seen_at", { ascending: false })
    .limit(80);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">
          Workflows
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          Observer Mode can recognize repeated marketing routines from sanitized event metadata. Kryx never raises autonomy by itself.
        </p>
      </header>

      <div className="space-y-3">
        {(workflows ?? []).filter((workflow) => workflow.status !== "ignored").map((workflow) => {
          const steps = Array.isArray(workflow.steps)
            ? (workflow.steps as Array<{ app?: string; event?: string }>)
            : [];

          return (
            <article key={workflow.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-bold text-fg-strong">{workflow.title}</h2>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {workflow.occurrences}× observed
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    {steps.map((step, index) => (
                      <span key={`${step.app}-${step.event}-${index}`} className="contents">
                        {index ? <span className="text-faint">→</span> : null}
                        <span className="rounded-md bg-bg px-2 py-1">
                          {prettyApp(step.app ?? "App")} · {(step.event ?? "action").replaceAll("_", " ")}
                        </span>
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-[12px] text-faint">
                    Confidence {Math.round(Number(workflow.confidence ?? 0) * 100)}% · Shadow runs {workflow.shadow_runs ?? 0}
                  </p>

                  {workflow.mode === "shadow" &&
                  workflow.last_shadow_result &&
                  typeof workflow.last_shadow_result === "object" ? (
                    <div className="mt-4 rounded-xl border border-line bg-bg p-3">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-faint">
                        Latest shadow comparison
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-muted">
                        Kryx produced a dry-run execution plan from the sanitized workflow metadata. No action was taken.
                      </p>
                      <pre className="mt-3 max-h-56 overflow-auto text-[11px] leading-relaxed text-faint">
                        {JSON.stringify(workflow.last_shadow_result, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>

                <div className="w-full max-w-xs">
                  <WorkflowDecision id={workflow.id} initialMode={workflow.mode ?? "observe"} />
                </div>
              </div>
            </article>
          );
        })}

        {!workflows?.some((workflow) => workflow.status !== "ignored") ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-[14px] text-muted">
            No repeated workflow has crossed Kryx&apos;s detection threshold yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
