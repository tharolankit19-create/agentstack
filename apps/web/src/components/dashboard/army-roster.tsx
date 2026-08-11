"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Pause, Play, Rocket, Settings } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Button } from "@/components/ui/button";
import { SQUADS, type SubAgent } from "@/lib/army";
import { formatRelative, cn } from "@/lib/utils";
import type { Agent, AgentStats } from "@/lib/supabase/types";

/**
 * The army, as an org chart you can act on.
 *
 * This replaced a searchable grid of every template in the catalog. The grid
 * was the right shape for the public directory, where a stranger arrives
 * looking for one specific tool, and exactly the wrong shape here: a customer
 * who has paid does not want to browse their own team, they want to see who
 * is working and who is stuck.
 *
 * So it is grouped by squad, in pipeline order, with the arrows drawn — the
 * order is real, the Optimizer genuinely cannot run before the Writer — and
 * every row says what that agent last produced rather than what subscription
 * it replaces.
 */

interface Row {
  sub: SubAgent;
  agent?: Agent;
  stats?: AgentStats;
}

export function ArmyRoster({
  agents,
  stats,
}: {
  agents: Agent[];
  stats: AgentStats[];
}) {
  const byTemplate = new Map(agents.map((agent) => [agent.template_id, agent]));
  const statsById = new Map(stats.map((row) => [row.agent_id, row]));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-fg-strong">The squads</h2>
        <p className="mt-0.5 text-sm text-muted">
          Everyone reporting to your head agent, in the order they run.
        </p>
      </div>

      <div className="space-y-3">
        {SQUADS.map((squad) => {
          const rows: Row[] = squad.pipeline.map((sub) => {
            const agent = sub.templateId ? byTemplate.get(sub.templateId) : undefined;
            return {
              sub,
              agent,
              stats: agent ? statsById.get(agent.id) : undefined,
            };
          });

          const live = rows.filter(
            (row) => row.agent?.status === "deployed" && !row.agent.paused,
          ).length;

          return (
            <div
              key={squad.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface-2"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
                <span className="text-lg" aria-hidden>
                  {squad.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-fg-strong">{squad.name}</p>
                  <p className="truncate text-sm text-muted">{squad.mission}</p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">
                  {squad.cadence}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-bold",
                    live === rows.length ? "text-live" : "text-faint",
                  )}
                >
                  {live}/{rows.length} live
                </span>
              </div>

              <ul>
                {rows.map((row, index) => (
                  <Member
                    key={row.sub.defaultName}
                    row={row}
                    last={index === rows.length - 1}
                    first={index === 0}
                  />
                ))}
              </ul>

              <p className="border-t border-line bg-surface px-5 py-2.5 text-xs text-muted">
                <span className="font-semibold text-fg">Hands you:</span>{" "}
                {squad.output}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Member({ row, first }: { row: Row; last: boolean; first: boolean }) {
  const router = useRouter();
  const { sub, agent, stats } = row;
  const [busy, setBusy] = useState<"deploy" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deploy() {
    if (!agent) return;
    setBusy("deploy");
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agent.id}/deploy`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Deploy failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deploy failed.");
    } finally {
      setBusy(null);
    }
  }

  async function toggle() {
    if (!agent) return;
    setBusy("toggle");
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agent.id}/toggle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !agent.paused }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not change that.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0">
      {/* The pipeline arrow. Drawn, not implied — these run in order. */}
      <span className="w-4 shrink-0 text-faint" aria-hidden>
        {first ? null : <ChevronRight className="size-4 -rotate-90" />}
      </span>

      <AgentAvatar
        name={sub.defaultName}
        seed={sub.templateId ?? sub.defaultName}
        size={34}
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold text-fg-strong">{sub.defaultName}</span>
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            {sub.name}
          </span>
        </p>
        <p className="truncate text-sm text-muted">{sub.does}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusText agent={agent} stats={stats} />

        {agent ? (
          <div className="flex items-center gap-1">
            <Link href={`/dashboard/agents/${agent.id}`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Configure ${sub.defaultName}`}
                title="Configure"
                className="text-muted hover:text-fg-strong"
              >
                <Settings />
              </Button>
            </Link>

            {agent.status === "deployed" ? (
              <Button
                onClick={toggle}
                disabled={busy !== null}
                variant="ghost"
                size="icon"
                aria-label={agent.paused ? `Start ${sub.defaultName}` : `Stop ${sub.defaultName}`}
                title={agent.paused ? "Start" : "Stop"}
                className="text-muted hover:text-fg-strong"
              >
                {busy === "toggle" ? (
                  <Loader2 className="animate-spin" />
                ) : agent.paused ? (
                  <Play />
                ) : (
                  <Pause />
                )}
              </Button>
            ) : (
              <Button onClick={deploy} disabled={busy !== null} size="sm">
                {busy === "deploy" || agent.status === "deploying" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Rocket />
                )}
                Deploy
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-faint">not enlisted</span>
        )}
      </div>

      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * What this agent is doing, in words.
 *
 * A coloured dot tells you the deployment state, which is the platform's
 * concern. What a founder wants to know is whether it did anything — so a
 * running agent that has produced nothing says so instead of glowing green.
 */
function StatusText({ agent, stats }: { agent?: Agent; stats?: AgentStats }) {
  if (!agent) return null;

  if (agent.status === "error") {
    return <span className="text-xs font-semibold text-danger">needs a look</span>;
  }
  if (agent.status === "deploying") {
    return <span className="text-xs font-semibold text-accent">deploying…</span>;
  }
  if (agent.status !== "deployed") {
    return <span className="text-xs text-faint">draft</span>;
  }
  if (agent.paused) {
    return <span className="text-xs font-semibold text-money">stopped</span>;
  }

  const produced = stats?.generations_this_month ?? 0;
  const lastRun = stats?.last_run_at ?? agent.last_run_at;

  return (
    <span className="text-right text-xs text-muted">
      <span className="block font-semibold text-live">
        {produced > 0 ? `${produced} this month` : "running"}
      </span>
      <span className="block text-faint">{formatRelative(lastRun)}</span>
    </span>
  );
}
