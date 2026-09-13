"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { LANES, inLane, type Mission } from "@/lib/missions-shared";

export function MissionBoard({ missions }: { missions: Mission[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {LANES.map((lane) => {
        const items = inLane(missions, lane.id);
        const urgent = lane.id === "needs_you";
        return (
          <section key={lane.id} className={urgent ? "rounded-xl border border-accent-line bg-accent-wash p-3" : "rounded-xl border border-line bg-surface-2 p-3"}>
            <header className="px-1.5 pb-3">
              <h2 className="flex items-baseline gap-2 text-[15px] font-bold text-fg-strong">
                {lane.name}
                <span className={urgent && items.length ? "rounded-full bg-accent px-1.5 text-[12px] font-bold text-accent-fg" : "text-[13px] font-semibold text-muted"}>{items.length}</span>
              </h2>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{lane.blurb}</p>
            </header>
            {items.length ? (
              <ul className="space-y-2">{items.map((mission) => <li key={mission.id}><MissionCard mission={mission} /></li>)}</ul>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[13px] text-faint">{emptyLine(lane.id)}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function emptyLine(lane: string): string {
  if (lane === "needs_you") return "Nothing waiting on you.";
  if (lane === "in_flight") return "Nobody working this minute.";
  if (lane === "queued") return "Nothing scheduled.";
  return "Nothing finished yet today.";
}

function MissionCard({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (approving) return;
    setApproving(true);
    setError(null);
    try {
      const response = await fetch("/api/missions/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ missionId: mission.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not approve this yet.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve this yet.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong">
      {mission.asks ? <p className="mb-1.5 text-[11.5px] font-bold text-accent">{mission.asks === "approval" ? "Needs your approval" : "Needs your decision"}</p> : null}
      <Link href={mission.href} className="block">
        <p className="text-[14px] font-semibold leading-snug text-fg-strong">{mission.title}</p>
        {mission.detail ? <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{mission.detail}</p> : null}
      </Link>
      <div className="mt-2.5 flex items-center gap-2">
        {mission.agentTemplateId ? <AgentAvatar name={mission.agentName ?? "Agent"} seed={mission.agentTemplateId} size={18} /> : null}
        {mission.agentName ? <span className="text-[12px] font-medium text-muted">{mission.agentName}</span> : null}
        <time dateTime={mission.at} className="ml-auto text-[12px] text-faint">{ago(mission.at)}</time>
      </div>
      {mission.asks === "approval" ? (
        <button type="button" onClick={() => void approve()} disabled={approving} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 text-[13px] font-bold text-accent-fg disabled:opacity-60">
          {approving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {approving ? "Approving…" : "Approve"}
        </button>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function ago(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const ahead = diff < 0;
  const minutes = Math.round(Math.abs(diff) / 60_000);
  const label = minutes < 1 ? "now" : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.round(minutes / 60)}h` : `${Math.round(minutes / 1440)}d`;
  return ahead && label !== "now" ? `in ${label}` : label;
}
