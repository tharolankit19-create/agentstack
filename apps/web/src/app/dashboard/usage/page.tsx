import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { quotaFor } from "@/lib/plans";
import { getTemplate, formatUsd, monthlySavings } from "@/lib/templates";
import { formatRelative } from "@/lib/utils";
import { UsageChart } from "@/components/dashboard/usage-chart";
import type { Agent, AgentRun, Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Usage and analytics.
 *
 * The question this page answers is "am I getting my money's worth", and the
 * only honest way to answer it is with what actually happened: runs that
 * succeeded, runs that failed, work produced, and which agent did it.
 *
 * Everything here is counted from rows. There is no modelled "time saved"
 * figure, because we do not know how long any of this would have taken a
 * human and inventing a number is how a usage page becomes marketing that
 * customers learn to scroll past. The savings figure is list price of the
 * tools being replaced, which is a real published number and is labelled as
 * exactly that.
 */
export default async function UsagePage() {
  const session = await requireUser("/dashboard/usage");
  const supabase = await createClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: agents }, { data: runs }, { data: generations }] = await Promise.all([
    supabase.from("agents").select("*").order("created_at", { ascending: true }),
    supabase
      .from("agent_runs")
      .select("*")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(500),
    supabase
      .from("generations")
      .select("id, agent_id, kind, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const owned = (agents ?? []) as Agent[];
  const runRows = (runs ?? []) as AgentRun[];
  const genRows = (generations ?? []) as Pick<
    Generation,
    "id" | "agent_id" | "kind" | "created_at"
  >[];

  const deployed = owned.filter((a) => a.status === "deployed");
  const live = deployed.filter((a) => !a.paused);
  const quota = quotaFor(session.profile);

  const failed = runRows.filter((run) => run.status === "error").length;
  const succeeded = runRows.length - failed;
  const successRate =
    runRows.length > 0 ? Math.round((succeeded / runRows.length) * 100) : null;

  const replaced = monthlySavings(
    live.filter((a) => !a.custom_agent_id).map((a) => a.template_id),
  );

  // Work per day, for the chart. Thirty buckets, oldest first.
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    byDay.set(day, 0);
  }
  for (const gen of genRows) {
    const day = gen.created_at.slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const series = [...byDay.entries()].map(([day, count]) => ({ day, count }));

  // Per agent, so it is obvious which one is earning its place.
  const perAgent = owned
    .map((agent) => {
      const template = getTemplate(agent.template_id);
      const agentRuns = runRows.filter((run) => run.agent_id === agent.id);
      const agentFails = agentRuns.filter((run) => run.status === "error").length;
      return {
        agent,
        name: agent.name || template?.name || "Agent",
        icon: template?.icon ?? "🧩",
        produced: genRows.filter((gen) => gen.agent_id === agent.id).length,
        runs: agentRuns.length,
        failed: agentFails,
        lastRun: agent.last_run_at,
      };
    })
    .sort((a, b) => b.produced - a.produced);

  const totalProduced = genRows.length;

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Usage</h1>
        <p className="mt-2 text-[15px] text-muted">
          The last 30 days, counted from what actually ran.
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Activity className="size-4" />}
          label="Agents live"
          value={`${live.length} / ${quota}`}
          note={
            deployed.length > live.length
              ? `${deployed.length - live.length} paused`
              : "all deployed agents running"
          }
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="Work produced"
          value={String(totalProduced)}
          note="drafts, replies and reports"
          tone="text-live"
        />
        <Stat
          icon={<CheckCircle2 className="size-4" />}
          label="Run success"
          value={successRate === null ? "—" : `${successRate}%`}
          note={
            runRows.length === 0
              ? "no runs yet"
              : `${succeeded} ok · ${failed} failed`
          }
          tone={successRate !== null && successRate < 80 ? "text-money" : "text-live"}
        />
        <Stat
          icon={<TrendingUp className="size-4" />}
          label="List price replaced"
          value={`${formatUsd(replaced)}/mo`}
          note="published prices of the live agents' tools"
        />
      </dl>

      {totalProduced > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold text-fg-strong">
            Output per day
          </h2>
          <UsageChart series={series} />
        </section>
      ) : null}

      {failed > 0 ? (
        <section className="rounded-2xl border border-money/40 bg-[var(--money-wash)] p-5">
          <p className="flex items-center gap-2 font-bold text-fg-strong">
            <AlertTriangle className="size-4 text-money" aria-hidden />
            {failed} {failed === 1 ? "run" : "runs"} failed in the last 30 days
          </p>
          <p className="mt-1.5 text-sm text-muted">
            Usually an expired API key or a page that stopped responding. Open
            the agent to see the exact error from its last run.
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xl font-bold text-fg-strong">By agent</h2>

        {perAgent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Nothing to measure yet. Deploy an agent and this page fills itself
            in.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                  <th className="px-4 py-3 font-semibold">Produced</th>
                  <th className="px-4 py-3 font-semibold">Runs</th>
                  <th className="px-4 py-3 font-semibold">Last run</th>
                </tr>
              </thead>
              <tbody>
                {perAgent.map((row) => (
                  <tr key={row.agent.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/agents/${row.agent.id}`}
                        className="flex items-center gap-2 font-semibold text-fg hover:text-accent"
                      >
                        <span aria-hidden>{row.icon}</span>
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fg">{row.produced}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {row.runs}
                      {row.failed > 0 ? (
                        <span className="ml-1.5 text-xs font-semibold text-money">
                          {row.failed} failed
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatRelative(row.lastRun)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  tone = "text-fg-strong",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <dt className="flex items-center gap-2 text-xs text-muted">
        <span className="text-faint">{icon}</span>
        {label}
      </dt>
      <dd className={`mt-1.5 text-2xl font-extrabold tabular-nums ${tone}`}>
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-faint">{note}</p>
    </div>
  );
}
