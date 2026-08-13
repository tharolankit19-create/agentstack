"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { HEAD_AGENT, memberFor, displayName } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";
import type { Agent, AgentStats } from "@/lib/supabase/types";

/**
 * The rest of the army — only the agents that actually exist.
 *
 * The version before this drew the entire org chart: every squad, every member,
 * and a dashed "waiting to be deployed" card for each one nobody had created.
 * That made a founder with one head agent look like they had fourteen, which is
 * exactly the confusion they asked to be rid of — "show me the agents I have,
 * not a warehouse of the ones I could".
 *
 * So this renders one small card per real agent and nothing else. The head
 * agent is not here — it has its own command card at the top — so this is
 * genuinely "everyone reporting to it that you've actually deployed". When the
 * only agent is the head, this section does not render at all, and the
 * dashboard is just the head agent, which is the point.
 *
 * Small and packed, too: 32px faces, tight type, three or four to a row, so the
 * squads read as a compact grid you scan, not a tall stack you scroll.
 */
export function ArmyRoster({
  agents,
  stats,
}: {
  agents: Agent[];
  stats: AgentStats[];
}) {
  const statsById = new Map(stats.map((row) => [row.agent_id, row]));

  // Real agents only, head excluded (it lives in the command card above). If
  // that leaves nothing, the whole section stays off the page.
  const squad = agents.filter((agent) => agent.template_id !== HEAD_AGENT.id);
  if (squad.length === 0) return null;

  const running = squad.filter(
    (agent) => agent.status === "deployed" && !agent.paused,
  ).length;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold text-fg-strong">Your squads</h2>
          <p className="text-xs text-muted">
            The agents you&apos;ve deployed under {HEAD_AGENT.defaultName}.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
            running > 0 ? "bg-[var(--live-wash)] text-live" : "bg-surface-3 text-faint",
          )}
        >
          {running}/{squad.length} live
        </span>
      </div>

      {/* Packed: two on a phone, up to four on a wide screen. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {squad.map((agent) => (
          <MemberCard
            key={agent.id}
            agent={agent}
            stats={statsById.get(agent.id)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * One deployed agent, as a small card.
 *
 * Tappable as a whole into the agent's page; the only inline control is stop,
 * shown just when there is something to stop and kept out of the way until
 * hover.
 */
function MemberCard({ agent, stats }: { agent: Agent; stats?: AgentStats }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const member = memberFor(agent.template_id);
  const template = getTemplate(agent.template_id);
  const name = displayName(agent.template_id, agent.name, template?.name);
  const role = member?.role ?? template?.name ?? "Agent";
  const running = agent.status === "deployed" && !agent.paused;

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
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

  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="group relative flex flex-col rounded-xl border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)]"
    >
      <div className="flex items-center gap-2">
        <AgentAvatar
          name={name}
          seed={agent.template_id}
          size={32}
          animated={running}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-fg-strong">
            {name}
          </p>
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-faint">
            {role}
          </p>
        </div>

        {running ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-label={`Stop ${name}`}
            title="Stop"
            className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg group-hover:opacity-100"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pause className="size-3.5" />
            )}
          </button>
        ) : agent.paused ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-label={`Start ${name}`}
            title="Start"
            className="shrink-0 rounded-md p-1 text-money hover:bg-surface-2"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-2.5 border-t border-line pt-2">
        <Status agent={agent} stats={stats} />
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-[11px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </Link>
  );
}

/** What this agent is doing, in one dot and a couple of words. */
function Status({ agent, stats }: { agent: Agent; stats?: AgentStats }) {
  const dot = (tone: string) => (
    <span className={cn("size-1.5 shrink-0 rounded-full", tone)} aria-hidden />
  );

  if (agent.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
        {dot("bg-danger")} needs a look
      </span>
    );
  }
  if (agent.status === "deploying") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent">
        {dot("bg-accent motion-safe:animate-pulse")} deploying…
      </span>
    );
  }
  if (agent.status !== "deployed") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-faint">
        {dot("bg-surface-3")} draft
      </span>
    );
  }
  if (agent.paused) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-money">
        {dot("bg-money")} stopped
      </span>
    );
  }

  const produced = stats?.generations_this_month ?? 0;
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-live">
      {dot("bg-live")}
      {produced > 0 ? `${produced} this month` : "running"}
    </span>
  );
}
