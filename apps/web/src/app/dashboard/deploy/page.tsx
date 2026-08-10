import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { DeploymentRow } from "@/components/dashboard/deployment-row";
import { SubscriptionPanel } from "@/components/dashboard/subscription-panel";
import { HostingCard } from "@/components/dashboard/hosting-card";
import { hostingStatus } from "@/lib/user-hosting";
import type { Agent, AgentRun, AgentStats } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  const session = await requireUser("/dashboard/deploy");
  const supabase = await createClient();

  const [{ data: agents }, { data: stats }, { data: runs }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase.from("agent_stats").select("*"),
    supabase
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const owned = (agents ?? []) as Agent[];
  const statsById = new Map(
    ((stats ?? []) as AgentStats[]).map((row) => [row.agent_id, row]),
  );

  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Deployments</h1>
        <p className="mt-2 text-[15px] text-muted">
          Every agent you deployed, where it lives, and what it did.
        </p>
      </header>

      {/* Where the agents actually run. Always shown here, unlike on the
          dashboard where it only appears when it is blocking something. */}
      <HostingCard initial={hostingStatus(session.profile)} />

      {owned.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nothing deployed yet.{" "}
          <Link href="/dashboard" className="font-semibold text-accent hover:underline">
            Pick an agent
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {owned.map((agent) => (
            <DeploymentRow
              key={agent.id}
              agent={agent}
              templateName={getTemplate(agent.template_id)?.name ?? agent.template_id}
              emoji={getTemplate(agent.template_id)?.icon ?? "🧩"}
              stats={statsById.get(agent.id)}
            />
          ))}
        </div>
      )}

      <SubscriptionPanel profile={session.profile} />

      <section>
        <h2 className="text-xl font-bold text-fg-strong">Recent runs</h2>
        <div className="mt-4 space-y-2">
          {((runs ?? []) as AgentRun[]).length === 0 ? (
            <p className="text-sm text-muted">
              No runs yet. Agents run on their own schedule once deployed.
            </p>
          ) : (
            ((runs ?? []) as AgentRun[]).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm"
              >
                <span
                  className={
                    run.status === "succeeded"
                      ? "size-2 rounded-full bg-live"
                      : "size-2 rounded-full bg-danger"
                  }
                  aria-hidden
                />
                <span className="font-medium text-muted">{run.trigger}</span>
                <span className="text-muted">
                  {new Date(run.started_at).toLocaleString()}
                </span>
                {run.error ? (
                  <span className="min-w-0 flex-1 truncate text-danger">
                    {run.error}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {run.output?.slice(0, 120) ?? ""}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
