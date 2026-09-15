"use client";

import { useState } from "react";
import { Check, MessageCircle, RotateCcw, Send } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import {
  DEMO_MISSIONS,
  DEMO_ROOM,
  DEMO_LEADS,
  DEMO_COMPANY,
  type DemoMission,
  type DemoRoomLine,
} from "@/lib/demo-data";

const LANES = [
  { id: "needs_you", name: "Needs you" },
  { id: "in_flight", name: "In flight" },
  { id: "queued", name: "Queued" },
  { id: "done", name: "Done today" },
] as const;

type Tab = "missions" | "room" | "leads";

const WORKSTREAM: Record<string, string> = {
  "head-agent": "Kryx",
  "outreach-agent": "Outreach",
  "seo-agent": "Search",
  "competitor-agent": "Competitor research",
  "lead-agent": "Pipeline",
  "content-agent": "Content",
  "research-agent": "Market research",
};

export function DemoConsole({ headName }: { headName: string }) {
  const [tab, setTab] = useState<Tab>("missions");
  const [missions, setMissions] = useState<DemoMission[]>(() => DEMO_MISSIONS.map((mission) => ({ ...mission })));
  const [selectedMissionId, setSelectedMissionId] = useState(DEMO_MISSIONS[0]?.id ?? "");
  const [room, setRoom] = useState<DemoRoomLine[]>(() => DEMO_ROOM.map((line) => ({ ...line })));
  const [roomDraft, setRoomDraft] = useState("");
  const [selectedLead, setSelectedLead] = useState(0);

  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? null;
  const lead = DEMO_LEADS[selectedLead] ?? DEMO_LEADS[0];

  function resetDemo() {
    setTab("missions");
    setMissions(DEMO_MISSIONS.map((mission) => ({ ...mission })));
    setSelectedMissionId(DEMO_MISSIONS[0]?.id ?? "");
    setRoom(DEMO_ROOM.map((line) => ({ ...line })));
    setRoomDraft("");
    setSelectedLead(0);
  }

  function approveMission() {
    if (!selectedMission) return;

    setMissions((current) =>
      current.map((mission): DemoMission =>
        mission.id === selectedMission.id
          ? {
              ...mission,
              lane: "done",
              asks: undefined,
              detail: mission.detail
                ? `${mission.detail} Approved in the demo.`
                : "Approved in the demo.",
              ago: "now",
            }
          : mission,
      ),
    );
  }

  function askKryx() {
    if (!selectedMission) return;
    setRoomDraft(`What should I do about: ${selectedMission.title}?`);
    setTab("room");
  }

  function sendRoomMessage() {
    const text = roomDraft.trim();
    if (!text) return;

    setRoom((current) => [
      ...current,
      {
        id: `demo-user-${current.length}`,
        who: null,
        templateId: null,
        body: text,
        at: "now",
      },
      {
        id: `demo-kryx-${current.length + 1}`,
        who: headName,
        templateId: "head-agent",
        body:
          "I would keep the decision with you, show the evidence behind it, and only let the specialist execute after approval. In the real workspace I would attach the live research and draft here.",
        at: "now",
      },
    ]);
    setRoomDraft("");
  }

  return (
    <div className="overflow-hidden border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-accent-wash px-2.5 py-1 text-[12px] font-bold text-accent">
            Demo mode
          </span>
          <p className="text-[13px] text-muted">
            {DEMO_COMPANY.name} · {DEMO_COMPANY.icp}
          </p>
        </div>
        <button
          onClick={resetDemo}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-surface-3 hover:text-fg-strong"
        >
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>

      <div className="grid lg:grid-cols-[190px_1fr]">
        <aside className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <p className="text-[12.5px] font-semibold text-muted">Since yesterday</p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {[["Work ready", "3"], ["Needs you", "2"], ["In progress", "2"], ["Sources saved", "7"]].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-3"><dt className="text-xs text-muted">{label}</dt><dd className="tnum text-base font-bold text-fg-strong">{value}</dd></div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">Kryx coordinates the work. Open any item to inspect it.</p>
        </aside>

        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Demo sections"
            className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 pt-3"
          >
            {([
              ["missions", "Mission Control"],
              ["room", "The room"],
              ["leads", "Leads"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "whitespace-nowrap rounded-t-lg border-b-2 border-accent px-3.5 py-2 text-[14px] font-bold text-fg-strong"
                    : "whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-3.5 py-2 text-[14px] font-medium text-muted hover:text-fg"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "missions" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {LANES.map((lane) => {
                    const items = missions.filter((mission) => mission.lane === lane.id);

                    return (
                      <section key={lane.id} className="rounded-xl border border-line bg-surface p-2.5">
                        <p className="flex items-baseline gap-2 px-1 pb-2 text-[13.5px] font-bold text-fg-strong">
                          {lane.name}
                          <span className="text-[12px] font-semibold text-muted">{items.length}</span>
                        </p>
                        <ul className="space-y-2">
                          {items.map((mission) => (
                            <li key={mission.id}>
                              <button
                                onClick={() => setSelectedMissionId(mission.id)}
                                className={`w-full rounded-lg border p-2.5 text-left transition ${
                                  selectedMissionId === mission.id
                                    ? "border-accent bg-accent-wash"
                                    : "border-line bg-surface-2 hover:border-line-strong"
                                }`}
                              >
                                {mission.asks ? (
                                  <p className="mb-1 text-[11px] font-bold text-accent">
                                    {mission.asks === "approval" ? "Needs your approval" : "Needs your decision"}
                                  </p>
                                ) : null}
                                <p className="text-[13px] font-semibold leading-snug text-fg-strong">{mission.title}</p>
                                {mission.detail ? (
                                  <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-muted">{mission.detail}</p>
                                ) : null}
                                <div className="mt-2 flex items-center gap-2">
                                  <AgentAvatar
                                    name={mission.agent}
                                    seed={mission.templateId}
                                    size={24}
                                  />
                                  <span className="text-[11.5px] font-medium text-muted">
                                    {WORKSTREAM[mission.templateId] ?? mission.agent}
                                  </span>
                                  <span className="ml-auto text-[11.5px] text-faint">{mission.ago}</span>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>

                {selectedMission ? (
                  <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-faint">Selected mission</p>
                      <p className="mt-1 text-sm font-bold text-fg-strong">{selectedMission.title}</p>
                    </div>
                    <div className="flex gap-2">
                      {selectedMission.lane !== "done" ? (
                        <button
                          onClick={approveMission}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-fg-strong px-3.5 text-[12px] font-bold text-bg"
                        >
                          <Check className="size-3.5" /> Approve
                        </button>
                      ) : null}
                      <button
                        onClick={askKryx}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[12px] font-bold text-fg-strong"
                      >
                        <MessageCircle className="size-3.5" /> Ask Kryx
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {tab === "room" ? (
              <div>
                <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                  {room.map((line) => (
                    <div key={line.id} className="flex gap-2.5">
                      {line.templateId ? (
                        <AgentAvatar
                          name={line.who === headName ? headName : WORKSTREAM[line.templateId] ?? line.who ?? "Agent"}
                          seed={line.templateId}
                          commander={line.who === headName}
                          size={28}
                        />
                      ) : (
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-[9px] font-bold text-fg">
                          You
                        </span>
                      )}

                      <div className="min-w-0">
                        <p className="flex items-baseline gap-2">
                          <span className="text-[13px] font-bold text-fg-strong">{line.templateId ? (line.who === headName ? headName : WORKSTREAM[line.templateId] ?? line.who) : "You"}</span>
                          <span className="text-[11.5px] text-faint">{line.at}</span>
                        </p>
                        <p className="mt-0.5 text-[14px] leading-relaxed text-fg">{line.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2 rounded-xl border border-line bg-surface p-2">
                  <input
                    value={roomDraft}
                    onChange={(event) => setRoomDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") sendRoomMessage();
                    }}
                    placeholder="Ask Kryx or @mention a specialist…"
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm text-fg-strong outline-none placeholder:text-faint"
                  />
                  <button
                    onClick={sendRoomMessage}
                    className="grid size-9 place-items-center rounded-lg bg-fg-strong text-bg"
                    aria-label="Send demo message"
                  >
                    <Send className="size-4" />
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] text-faint">
                  Demo replies are fixed examples. The real room runs your connected agents and tools.
                </p>
              </div>
            ) : null}

            {tab === "leads" && lead ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-[13.5px]">
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
                      {DEMO_LEADS.map((item, index) => (
                        <tr key={item.name} className={selectedLead === index ? "bg-accent-wash" : ""}>
                          <td className="py-2.5 pr-3">
                            <button
                              onClick={() => setSelectedLead(index)}
                              className="text-left font-medium text-fg-strong hover:underline"
                            >
                              {item.name}
                              <span className="block text-[12px] font-normal text-muted">{item.title}</span>
                            </button>
                          </td>
                          <td className="py-2.5 pr-3 text-muted">{item.company}</td>
                          <td className="py-2.5 pr-3 text-muted">{item.stage}</td>
                          <td className="py-2.5 pr-3 tabular-nums text-muted">{item.score}</td>
                          <td className="py-2.5 text-muted">{item.why}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[.12em] text-faint">Lead selected</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-bold text-fg-strong">{lead.name} · {lead.company}</p>
                    <span className="text-xs text-muted">fit {lead.score}/10</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{lead.why}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
