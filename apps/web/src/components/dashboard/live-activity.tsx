"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { formatRelative } from "@/lib/utils";

/**
 * The army in motion.
 *
 * When the founder messages the head agent, or a squad picks up work, this is
 * where it comes alive: the working agents light up by name with what they are
 * doing, the head agent shown conducting them, dots flowing between the two so
 * the whole thing reads as a team moving — not a spinner that says "working".
 * That was the note: don't make it boring, show me who is doing what and the
 * head agent holding it together.
 *
 * When nothing is running it goes quiet and shows the last thing that landed, so
 * "idle" and "broken" never look the same. It polls a cheap endpoint every few
 * seconds; a dropped poll simply waits for the next tick.
 */

interface WorkingItem {
  templateId: string;
  agentId: string | null;
  name: string;
  label: string;
}

interface RecentItem {
  agentId: string | null;
  name: string;
  templateId: string;
  kind: string;
  at: string;
}

const HEAD = "head-agent";

function verbFor(kind: string): string {
  switch (kind) {
    case "briefing":
      return "wrote your briefing";
    case "alert":
      return "spotted something";
    case "tweet":
      return "drafted a post";
    case "linkedin":
      return "drafted a LinkedIn post";
    case "note":
      return "finished a task";
    default:
      return "just worked";
  }
}

export function LiveActivity() {
  const [data, setData] = useState<{
    working: WorkingItem[];
    recent: RecentItem[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          working: WorkingItem[];
          recent: RecentItem[];
        };
        if (alive) setData(payload);
      } catch {
        // A dropped poll is nothing to show — try again next tick.
      }
    }
    pull();
    // Poll faster while something is working, so the motion feels live.
    const timer = setInterval(pull, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!data) {
    return (
      <section className="h-[92px] animate-pulse rounded-2xl border border-line bg-surface-2" />
    );
  }

  const { working, recent } = data;

  if (working.length > 0) {
    return <WorkingView working={working} />;
  }

  // Idle — the last thing that landed, calm.
  if (recent.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface-2 px-5 py-4">
        <p className="text-sm text-muted">
          Your army is standing by. The moment an agent picks something up, you
          will see it move here.
        </p>
      </section>
    );
  }

  const lead = recent[0];
  return (
    <section className="rounded-2xl border border-line bg-surface-2 px-5 py-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
        <span className="size-2 rounded-full bg-surface-3" aria-hidden />
        Latest activity
      </p>
      <Link
        href={lead.agentId ? `/dashboard/agents/${lead.agentId}` : "/dashboard"}
        className="flex items-center gap-3"
      >
        <AgentAvatar
          name={lead.name}
          seed={lead.templateId}
          size={40}
          commander={lead.templateId === HEAD}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-bold text-fg-strong">{lead.name}</span>{" "}
            <span className="text-muted">{verbFor(lead.kind)}</span>
          </p>
          <p className="text-xs text-faint">{formatRelative(lead.at)}</p>
        </div>
      </Link>
    </section>
  );
}

/**
 * The live view: head agent conducting, the workers moving.
 *
 * Deliberately theatrical — pulsing rings on the commander, dots flowing toward
 * the squad, breathing faces — because the whole point is that the founder
 * enjoys watching their army work.
 */
function WorkingView({ working }: { working: WorkingItem[] }) {
  // The head agent conducts; everyone else is a worker. If the head agent isn't
  // itself in the working set, it still presides — it always does.
  const head = working.find((w) => w.templateId === HEAD);
  const workers = working.filter((w) => w.templateId !== HEAD);
  const conductorLabel = head?.label ?? "conducting your squads";
  const headName = head?.name ?? "Seamus";

  return (
    <section className="overflow-hidden rounded-2xl border border-live/40 bg-[var(--live-wash)] px-5 py-4">
      <style>{FLOW_CSS}</style>

      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-live">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        Your army is working
      </p>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* The commander, conducting. */}
        <div className="flex w-24 shrink-0 flex-col items-center gap-1.5 text-center">
          <span className="max-w-full truncate text-xs font-bold text-fg-strong">
            {headName}
          </span>
          <span className="relative grid place-items-center">
            <span className="absolute size-14 rounded-full border-2 border-live/40 maa-ring" aria-hidden />
            <AgentAvatar name={headName} seed={HEAD} size={52} commander animated />
          </span>
          <span className="text-[10px] font-medium leading-tight text-muted">
            {conductorLabel}
          </span>
        </div>

        {/* The flow between conductor and workers. */}
        <div className="relative h-14 flex-1 overflow-hidden" aria-hidden>
          <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-live/25" />
          <span className="maa-dot" style={{ animationDelay: "0s" }} />
          <span className="maa-dot" style={{ animationDelay: "0.7s" }} />
          <span className="maa-dot" style={{ animationDelay: "1.4s" }} />
        </div>

        {/* The workers. */}
        <div className="flex max-w-[62%] flex-wrap justify-end gap-3 sm:gap-4">
          {workers.length > 0 ? (
            workers.slice(0, 4).map((worker) => (
              <WorkerChip key={worker.templateId} worker={worker} />
            ))
          ) : (
            <span className="self-center text-xs text-muted">
              lining up the squads…
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkerChip({ worker }: { worker: WorkingItem }) {
  const inner = (
    <div className="flex w-20 flex-col items-center gap-1.5 text-center maa-float">
      <span className="max-w-full truncate text-xs font-bold text-fg-strong">
        {worker.name}
      </span>
      <AgentAvatar name={worker.name} seed={worker.templateId} size={44} animated />
      <span className="max-w-full text-[10px] font-medium leading-tight text-live maa-shimmer">
        {worker.label}
      </span>
    </div>
  );

  return worker.agentId ? (
    <Link href={`/dashboard/agents/${worker.agentId}`}>{inner}</Link>
  ) : (
    inner
  );
}

/**
 * Motion, in one place.
 *
 * Kept as plain CSS keyframes injected once, rather than Tailwind config, so the
 * component is self-contained. All of it is wrapped in `prefers-reduced-motion`
 * except the essentials, so it calms down for anyone who asked the OS to.
 */
const FLOW_CSS = `
@keyframes maa-flow {
  0% { left: -6px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}
@keyframes maa-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes maa-ringpulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  70% { transform: scale(1.25); opacity: 0; }
  100% { opacity: 0; }
}
@keyframes maa-shimmerkf {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
.maa-dot {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 9999px;
  background: var(--live, #16a34a);
}
@media (prefers-reduced-motion: no-preference) {
  .maa-dot { animation: maa-flow 2.1s linear infinite; }
  .maa-float { animation: maa-float 2.4s ease-in-out infinite; }
  .maa-ring { animation: maa-ringpulse 2s ease-out infinite; }
  .maa-shimmer { animation: maa-shimmerkf 1.6s ease-in-out infinite; }
}
`;
