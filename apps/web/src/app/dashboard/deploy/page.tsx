import Link from "next/link";
import { requirePaidUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplate, presentationFor } from "@/lib/templates";
import { DeploymentRow } from "@/components/dashboard/deployment-row";
import type { Agent, AgentRun, AgentStats } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DeployPage() {
  await requirePaidUser("/dashboard/deploy");
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
        <h1 className="text-3xl font-extrabold text-white">Deployments</h1>
        <p className="mt-2 text-[15px] text-zinc-400">
          Every agent you deployed, where it lives, and what it did.
        </p>
      </header>

      {owned.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-surface-line)] p-8 text-center text-sm text-zinc-500">
          Nothing deployed yet.{" "}
          <Link href="/dashboard" className="font-semibold text-[#c4b5fd] hover:underline">
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
              emoji={presentationFor(agent.template_id).emoji}
              stats={statsById.get(agent.id)}
            />
          ))}
        </div>
      )}

      <section>
        <h2 className="text-xl font-bold text-white">Recent runs</h2>
        <div className="mt-4 space-y-2">
          {((runs ?? []) as AgentRun[]).length === 0 ? (
            <p className="text-sm text-zinc-500">
              No runs yet. Agents run on their own schedule once deployed.
            </p>
          ) : (
            ((runs ?? []) as AgentRun[]).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-surface-line)] px-4 py-3 text-sm"
              >
                <span
                  className={
                    run.status === "succeeded"
                      ? "size-2 rounded-full bg-emerald-500"
                      : "size-2 rounded-full bg-red-500"
                  }
                  aria-hidden
                />
                <span className="font-medium text-zinc-300">{run.trigger}</span>
                <span className="text-zinc-500">
                  {new Date(run.started_at).toLocaleString()}
                </span>
                {run.error ? (
                  <span className="min-w-0 flex-1 truncate text-red-400">
                    {run.error}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-zinc-500">
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
