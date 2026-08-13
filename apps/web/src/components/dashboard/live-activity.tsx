"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { formatRelative } from "@/lib/utils";

/**
 * "Who's working right now" — the live pulse of the army.
 *
 * When the founder messages the head agent, or a squad produces something, this
 * is where it shows: the agent's name above its face, breathing while it works.
 * It answers the question the founder asked for directly — "when someone
 * messages, show me which agent is doing the work" — without opening a page.
 *
 * Polls a cheap endpoint every few seconds. It is deliberately quiet: nothing
 * happening shows the last thing that did, not an empty box, because "silent
 * for an hour" and "broken" should never look the same.
 */

interface ActivityItem {
  agentId: string;
  name: string;
  role: string | null;
  templateId: string;
  kind: string;
  at: string;
  working: boolean;
}

/** Turn a generation kind into a human verb. */
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
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { items: ActivityItem[] };
        if (alive) setItems(payload.items);
      } catch {
        // A dropped poll is nothing to show the founder — try again next tick.
      }
    }
    pull();
    const timer = setInterval(pull, 6000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Nothing has ever happened yet — say so plainly, once there is data.
  if (items && items.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface-2 px-5 py-4">
        <p className="text-sm text-muted">
          Nothing running yet. The moment an agent does something, it shows up
          here.
        </p>
      </section>
    );
  }

  if (!items) {
    return (
      <section className="h-[74px] animate-pulse rounded-2xl border border-line bg-surface-2" />
    );
  }

  const working = items.filter((item) => item.working).slice(0, 4);
  const lead = items[0];
  const anyWorking = working.length > 0;

  return (
    <section className="rounded-2xl border border-line bg-surface-2 px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-faint">
          <span
            className={
              anyWorking
                ? "size-2 rounded-full bg-live motion-safe:animate-pulse"
                : "size-2 rounded-full bg-surface-3"
            }
            aria-hidden
          />
          {anyWorking ? "Working now" : "Latest activity"}
        </p>
      </div>

      {anyWorking ? (
        // The agents currently at work, name above the face, breathing.
        <div className="mt-3 flex flex-wrap gap-4">
          {working.map((item) => (
            <Link
              key={item.agentId}
              href={`/dashboard/agents/${item.agentId}`}
              className="flex w-20 flex-col items-center gap-1.5 text-center"
            >
              <span className="max-w-full truncate text-xs font-bold text-fg-strong">
                {item.name}
              </span>
              <AgentAvatar
                name={item.name}
                seed={item.templateId}
                size={44}
                animated
                commander={item.templateId === "head-agent"}
              />
              <span className="text-[10px] font-medium text-live">working…</span>
            </Link>
          ))}
        </div>
      ) : (
        // The last thing that landed, with who did it and when.
        <Link
          href={`/dashboard/agents/${lead.agentId}`}
          className="mt-3 flex items-center gap-3"
        >
          <AgentAvatar
            name={lead.name}
            seed={lead.templateId}
            size={40}
            commander={lead.templateId === "head-agent"}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-bold text-fg-strong">{lead.name}</span>{" "}
              <span className="text-muted">{verbFor(lead.kind)}</span>
            </p>
            <p className="text-xs text-faint">{formatRelative(lead.at)}</p>
          </div>
        </Link>
      )}
    </section>
  );
}
