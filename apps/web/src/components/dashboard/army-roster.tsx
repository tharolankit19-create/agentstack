"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { SQUADS, type SubAgent } from "@/lib/army";
import { formatRelative, cn } from "@/lib/utils";
import type { Agent, AgentStats } from "@/lib/supabase/types";

/**
 * The army, as tidy cards you can read at a glance.
 *
 * The previous version was a stack of full-width rows with a settings cog and a
 * play/pause on each — busy, tall, and repetitive down the page. A founder does
 * not read fourteen rows; they scan for who is working and who is stuck.
 *
 * So each squad is its own rounded, shadowed panel with a clear header, and its
 * agents sit inside as small cards in a grid — packed, gapped, and self-similar
 * so the eye groups them by squad instantly. The only control left on a card is
 * the one that is occasionally needed: stop a running agent. Everything else is
 * a tap into the agent's own page. Turning the army on lives in one button at
 * the top of the dashboard, not fourteen times over.
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
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-fg-strong">The squads</h2>
        <p className="mt-0.5 text-sm text-muted">
          Everyone reporting to your head agent.
        </p>
      </div>

      <div className="grid gap-5">
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
              className="overflow-hidden rounded-3xl border border-line bg-surface-2 shadow-[var(--shadow)]"
            >
              <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-3 text-lg"
                  aria-hidden
                >
                  {squad.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-tight text-fg-strong">
                    {squad.name}
                  </p>
                  <p className="truncate text-sm text-muted">{squad.mission}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                    live === rows.length && rows.length > 0
                      ? "bg-[var(--live-wash)] text-live"
                      : "bg-surface-3 text-faint",
                  )}
                >
                  {live}/{rows.length} live
                </span>
              </div>

              {/* The agents, packed as cards. Two up on a phone, up to four on a
                  wide screen, always with room to breathe between them. */}
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <MemberCard key={row.sub.defaultName} row={row} />
                ))}
              </div>

              <p className="border-t border-line bg-surface px-5 py-3 text-xs leading-relaxed text-muted">
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

/**
 * One agent, as a small card.
 *
 * Tappable as a whole (it goes to the agent's page); the stop button is the one
 * exception, stopped from bubbling so a founder can pause a runaway without
 * leaving the overview.
 */
function MemberCard({ row }: { row: Row }) {
  const router = useRouter();
  const { sub, agent, stats } = row;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = agent?.status === "deployed" && !agent.paused;

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!agent) return;
    setBusy(true);
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
      setBusy(false);
    }
  }

  const card = (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border p-4 transition-all",
        agent
          ? "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
          : "border-dashed border-line bg-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar
          name={sub.defaultName}
          seed={sub.templateId ?? sub.defaultName}
          size={40}
          animated={running}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight text-fg-strong">
            {sub.defaultName}
          </p>
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-faint">
            {sub.name}
          </p>
        </div>

        {/* Stop, only when there is something to stop. Small, and out of the
            way until hovered. */}
        {running ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-label={`Stop ${sub.defaultName}`}
            title="Stop"
            className="shrink-0 rounded-lg p-1 text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg group-hover:opacity-100"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Pause className="size-4" />
            )}
          </button>
        ) : agent?.paused ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-label={`Start ${sub.defaultName}`}
            title="Start"
            className="shrink-0 rounded-lg p-1 text-money hover:bg-surface-2"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          </button>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-[13px] leading-relaxed text-muted">
        {sub.does}
      </p>

      <div className="mt-3 border-t border-line pt-2.5">
        <Status agent={agent} stats={stats} />
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );

  // The whole card is a link when the agent exists.
  return agent ? (
    <Link href={`/dashboard/agents/${agent.id}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

/**
 * What this agent is doing, in words and one dot.
 *
 * The dot is state; the words are whether it earned its place. A running agent
 * that has produced nothing says "running", not a green light that overclaims.
 */
function Status({ agent, stats }: { agent?: Agent; stats?: AgentStats }) {
  if (!agent) {
    return <span className="text-xs text-faint">waiting to be deployed</span>;
  }

  const dot = (tone: string) => (
    <span className={cn("size-1.5 shrink-0 rounded-full", tone)} aria-hidden />
  );

  if (agent.status === "error") {
    return (
      <span className="flex items-center gap-2 text-xs font-semibold text-danger">
        {dot("bg-danger")} needs a look
      </span>
    );
  }
  if (agent.status === "deploying") {
    return (
      <span className="flex items-center gap-2 text-xs font-semibold text-accent">
        {dot("bg-accent motion-safe:animate-pulse")} deploying…
      </span>
    );
  }
  if (agent.status !== "deployed") {
    return (
      <span className="flex items-center gap-2 text-xs text-faint">
        {dot("bg-surface-3")} draft
      </span>
    );
  }
  if (agent.paused) {
    return (
      <span className="flex items-center gap-2 text-xs font-semibold text-money">
        {dot("bg-money")} stopped
      </span>
    );
  }

  const produced = stats?.generations_this_month ?? 0;
  const lastRun = stats?.last_run_at ?? agent.last_run_at;

  return (
    <span className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-2 font-semibold text-live">
        {dot("bg-live")}
        {produced > 0 ? `${produced} this month` : "running"}
      </span>
      <span className="text-faint">{formatRelative(lastRun)}</span>
    </span>
  );
}
