"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { initialsFor } from "@/lib/ref";
import { ApproveButton } from "./approve-button";
import type { Mission } from "@/lib/missions-shared";

/**
 * The things that stop until the founder answers.
 *
 * Named for what it is rather than what it contains. "Drafts" and "pending
 * approvals" describe the objects; "needs you" describes the obligation, and
 * the obligation is the only reason this block is at the top of the page.
 *
 * An empty state is shown rather than hidden. A founder who opens the dashboard
 * and sees nothing cannot tell whether nothing is waiting or whether the page
 * failed to load, and those are opposite feelings.
 */
export function NeedsYou({ missions, total }: { missions: Mission[]; total: number }) {
  // Approved rows leave the list at once. See the note in mission-board: a
  // queue that stays put until the server re-renders reads as a dead button.
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const visible = missions.filter((m) => !cleared.has(m.id));

  if (!total) {
    return (
      <section className="ledger p-5">
        <p className="text-[15px] font-semibold text-fg-strong">Nothing is waiting on you.</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          The team is running on its own. Anything that needs an approval or a
          decision will appear here and in your morning message.
        </p>
      </section>
    );
  }

  return (
    <section className="ledger ticked p-5">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[17px] font-bold text-fg-strong">
          {total} {total === 1 ? "thing needs" : "things need"} you
        </h2>
        <Link
          href="/dashboard/missions"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-fg hover:text-fg-strong"
        >
          Mission Control
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <p className="mt-1 text-[14px] text-muted">
        An approval, a decision, or an answer only you can give.
      </p>

      <ul className="mt-4 space-y-2">
        {visible.map((mission) => (
          <li key={mission.id}>
            <Link
              href={mission.href}
              className="flex items-start gap-3 border border-line bg-surface-2 p-3.5 transition-colors hover:border-line-strong"
            >
              {mission.agentTemplateId ? (
                <span
                  className="grid size-7 shrink-0 place-items-center border border-line-strong bg-surface font-mono text-[10px] font-semibold uppercase text-muted"
                  aria-hidden
                >
                  {initialsFor(mission.agentName)}
                </span>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-fg-strong">
                  {mission.title}
                </p>
                {mission.detail ? (
                  <p className="mt-0.5 truncate text-[13px] text-muted">{mission.detail}</p>
                ) : null}
              </div>

              {/* The real button, not a label that looks like one. This row
                  used to read "Approve" in accent text and do nothing but
                  navigate — the label was the whole lie. */}
              <span className="shrink-0 self-center">
                {mission.asks === "approval" && mission.generationId ? (
                  <ApproveButton
                    generationId={mission.generationId}
                    onDone={() => setCleared((prev) => new Set(prev).add(mission.id))}
                    size="sm"
                  />
                ) : (
                  <span className="text-[12px] font-bold text-accent">Decide</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {total > missions.length ? (
        <p className="mt-3 text-[13px] text-muted">
          and {total - missions.length} more in Mission Control.
        </p>
      ) : null}
    </section>
  );
}
