"use client";

import { useState } from "react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import {
  DEMO_MISSIONS,
  DEMO_ROOM,
  DEMO_LEADS,
  DEMO_SQUAD,
  DEMO_COMPANY,
  type DemoMission,
} from "@/lib/demo-data";

/**
 * The console, on the landing page.
 *
 * Three tabs, in the order a visitor's questions arrive: what needs me, what
 * are they saying to each other, who did they find. Mission Control leads
 * because "what is waiting on you" is the product's actual claim, and because a
 * board with three things in a Needs-you column explains the proposition faster
 * than any paragraph above it.
 *
 * It is a real interface with fixed rows, not a video and not an animation. A
 * visitor can click between tabs and read every line, which is the point — a
 * looping screencast shows the parts we chose at the speed we chose them.
 */

const LANES = [
  { id: "needs_you", name: "Needs you", blurb: "Nothing moves until you answer" },
  { id: "in_flight", name: "In flight", blurb: "Happening right now" },
  { id: "queued", name: "Queued", blurb: "Scheduled" },
  { id: "done", name: "Done today", blurb: "Since midnight" },
] as const;

type Tab = "missions" | "room" | "leads";

export function DemoConsole({ headName }: { headName: string }) {
  const [tab, setTab] = useState<Tab>("missions");

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-lg">
      {/* The frame carries the sample label rather than a dismissible banner —
          a notice designed to be closed is one that gets closed, and a visitor
          who signs up expecting these exact leads has been misled. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[12px] font-bold text-accent">
          Sample
        </span>
        <p className="text-[13px] text-muted">
          {DEMO_COMPANY.name} · {DEMO_COMPANY.icp}
        </p>
      </div>

      <div className="grid lg:grid-cols-[210px_1fr]">
        <aside className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <p className="text-[12.5px] font-semibold text-muted">Your squad</p>

          <ul className="mt-3 space-y-3">
            <li className="flex items-center gap-2.5">
              <AgentAvatar name={headName} seed="head-agent" size={28} commander />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-bold text-fg-strong">
                  {headName}
                </span>
                <span className="block truncate text-[12px] text-muted">Head of marketing</span>
              </span>
            </li>

            {DEMO_SQUAD.map((member) => (
              <li key={member.name} className="flex items-center gap-2.5">
                <AgentAvatar name={member.name} seed={member.templateId} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-fg-strong">
                    {member.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{member.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Demo sections"
            className="flex gap-1 border-b border-line px-3 pt-3"
          >
            {(
              [
                ["missions", "Mission Control"],
                ["room", "The room"],
                ["leads", "Leads"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "rounded-t-lg border-b-2 border-accent px-3.5 py-2 text-[14px] font-bold text-fg-strong"
                    : "rounded-t-lg border-b-2 border-transparent px-3.5 py-2 text-[14px] font-medium text-muted hover:text-fg"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "missions" ? <Missions /> : null}
            {tab === "room" ? <Room headName={headName} /> : null}
            {tab === "leads" ? <Leads /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Missions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {LANES.map((lane) => {
        const items = DEMO_MISSIONS.filter((m) => m.lane === lane.id);
        const urgent = lane.id === "needs_you";

        return (
          <section
            key={lane.id}
            className={
              urgent
                ? "rounded-xl border border-accent-line bg-accent-wash p-2.5"
                : "rounded-xl border border-line bg-surface p-2.5"
            }
          >
            <p className="flex items-baseline gap-2 px-1 pb-2 text-[13.5px] font-bold text-fg-strong">
              {lane.name}
              <span
                className={
                  urgent
                    ? "rounded-full bg-accent px-1.5 text-[11.5px] font-bold text-accent-fg"
                    : "text-[12px] font-semibold text-muted"
                }
              >
                {items.length}
              </span>
            </p>

            <ul className="space-y-2">
              {items.map((mission) => (
                <li key={mission.id}>
                  <Card mission={mission} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Card({ mission }: { mission: DemoMission }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-2.5">
      {mission.asks ? (
        <p className="mb-1 text-[11px] font-bold text-accent">
          {mission.asks === "approval" ? "Needs your approval" : "Needs your decision"}
        </p>
      ) : null}

      <p className="text-[13px] font-semibold leading-snug text-fg-strong">{mission.title}</p>

      {mission.detail ? (
        <p className="mt-1 text-[12px] leading-snug text-muted">{mission.detail}</p>
      ) : null}

      <p className="mt-2 flex items-center gap-1.5">
        <AgentAvatar name={mission.agent} seed={mission.templateId} size={16} />
        <span className="text-[11.5px] font-medium text-muted">{mission.agent}</span>
        <span className="ml-auto text-[11.5px] text-faint">{mission.ago}</span>
      </p>
    </div>
  );
}

function Room({ headName }: { headName: string }) {
  return (
    <div className="space-y-4">
      {DEMO_ROOM.map((line) => (
        <div key={line.id} className="flex gap-2.5">
          {line.templateId ? (
            <AgentAvatar
              name={line.who ?? "Agent"}
              seed={line.templateId}
              size={28}
              commander={line.who === headName}
            />
          ) : (
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-fg"
              aria-hidden
            >
              You
            </span>
          )}

          <div className="min-w-0">
            <p className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-fg-strong">{line.who ?? "You"}</span>
              <span className="text-[11.5px] text-faint">{line.at}</span>
            </p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-fg">{line.body}</p>
          </div>
        </div>
      ))}

      <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
        In yours, naming someone puts them on the job for real — they run, then
        report back here.
      </p>
    </div>
  );
}

function Leads() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-[13.5px]">
        <thead className="border-b border-line text-[12.5px] text-muted">
          <tr>
            <th className="py-2 pr-3 font-semibold">Name</th>
            <th className="py-2 pr-3 font-semibold">Company</th>
            <th className="py-2 pr-3 font-semibold">Stage</th>
            <th className="py-2 pr-3 font-semibold">Fit</th>
            <th className="py-2 font-semibold">Why them</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {DEMO_LEADS.map((lead) => (
            <tr key={lead.name}>
              <td className="py-2.5 pr-3 font-medium text-fg-strong">
                {lead.name}
                <span className="block text-[12px] font-normal text-muted">{lead.title}</span>
              </td>
              <td className="py-2.5 pr-3 text-muted">{lead.company}</td>
              <td className="py-2.5 pr-3 text-muted">{lead.stage}</td>
              <td className="py-2.5 pr-3 tabular-nums text-muted">{lead.score}</td>
              <td className="py-2.5 text-muted">{lead.why}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[12.5px] text-muted">
        Each one judged against the customer profile, with the reason kept. The
        ones dropped are kept too, so you can see what it said no to.
      </p>
    </div>
  );
}
