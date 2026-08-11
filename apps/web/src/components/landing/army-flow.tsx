"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { HEAD_AGENT, SQUADS } from "@/lib/army";
import { AgentFace } from "@/components/ui/agent-avatar";
import { cn } from "@/lib/utils";

/**
 * The loop, running.
 *
 * The earlier version drew this left to right and lit one squad at a time,
 * which described a pipeline: six things happen in order and something comes
 * out of the end. That is not what the product does. What it does is a round
 * trip that starts and ends with the founder — you message Seamus, Seamus
 * briefs the whole army at once, the army works in parallel, it reports back to
 * Seamus, and Seamus messages you that it is done.
 *
 * Three consequences for the drawing:
 *
 *   1. **The wires arc.** Two out along the top, two back along the bottom. A
 *      loop drawn as a straight line is a loop nobody reads as one.
 *   2. **Everybody works at once.** Thirteen agents light up together, because
 *      they do. Lighting them one at a time made the product look thirteen
 *      times slower than it is.
 *   3. **The wires never stop moving.** Even between phases. Traffic that only
 *      animates on the active edge makes the rest of the graph look dead.
 *
 * And it is short. The whole thing fits in half a screen, because a section
 * that needs scrolling to see the loop is a section where nobody sees the loop.
 */

/* ── Canvas geometry ─────────────────────────────────────────────────────── */
const W = 1000;
const H = 330;
const SPINE = 168;

const YOU = { x: 20, y: SPINE - 40, w: 150, h: 80 };
const BOSS = { x: 250, y: SPINE - 47, w: 158, h: 94 };
const CREW = { x: 470, y: 26, w: 510, h: 282 };

/** The thirteen, flattened out of the squads in the order they appear. */
const CREW_MEMBERS = SQUADS.flatMap((squad) =>
  squad.pipeline.map((sub) => ({
    name: sub.defaultName,
    role: sub.name,
    seed: sub.templateId ?? sub.defaultName,
    squad: squad.name,
  })),
);

// Five across, three deep. Four across left a single agent stranded on a
// fourth row whose label fell outside the panel — and a lone Bea under twelve
// others reads as an afterthought rather than a member of the army.
const COLS = 5;
const CELL_W = CREW.w / COLS;
const CELL_H = 78;

/** An arc between two node edges. Up for the outbound half, down for the return. */
function arc(x1: number, y1: number, x2: number, y2: number, lift: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1 - lift}, ${mx} ${y2 - lift}, ${x2} ${y2}`;
}

/* ── The cycle ───────────────────────────────────────────────────────────── */

type Phase = "ask" | "dispatch" | "working" | "report" | "deliver" | "done";

const SCRIPT: { phase: Phase; ms: number }[] = [
  { phase: "ask", ms: 1100 },
  { phase: "dispatch", ms: 900 },
  { phase: "working", ms: 2400 },
  { phase: "report", ms: 1000 },
  { phase: "deliver", ms: 900 },
  { phase: "done", ms: 3200 },
];

/** What the founder sees on their phone at each beat. */
const CHATTER: Record<Phase, { from: "you" | "boss"; text: string }> = {
  ask: { from: "you", text: "morning — what's on today?" },
  dispatch: {
    from: "boss",
    text: `On it. Briefing all ${CREW_MEMBERS.length} of them now.`,
  },
  working: { from: "boss", text: "Everyone's working. Two minutes." },
  report: { from: "boss", text: "Results coming back in…" },
  deliver: { from: "boss", text: "Putting it together." },
  done: {
    from: "boss",
    text: "Done. 5 posts drafted, 12 leads scored, Northwind cut their starter tier to $19, 2 replies ready. Reply 1 and I'll send you the lot.",
  },
};

export function ArmyFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Reduced motion gets the finished state, which is the one worth seeing.
    if (reduced) {
      setStep(SCRIPT.length - 1);
      return;
    }
    if (!visible) return;

    const timer = setTimeout(
      () => setStep((current) => (current + 1) % SCRIPT.length),
      SCRIPT[step].ms,
    );
    return () => clearTimeout(timer);
  }, [visible, reduced, step]);

  const phase = SCRIPT[step].phase;

  // Which of the four wires is carrying traffic right now. All four are always
  // animated; this is only which one is lit.
  const hot = useMemo(
    () => ({
      ask: phase === "ask",
      dispatch: phase === "dispatch",
      report: phase === "report",
      deliver: phase === "deliver",
    }),
    [phase],
  );

  const crewBusy = phase === "dispatch" || phase === "working" || phase === "report";
  const crewDone = phase === "deliver" || phase === "done";

  return (
    <section className="grid-field relative border-b border-line px-5 py-14 sm:py-20">
      <div ref={containerRef} className="relative mx-auto max-w-5xl">
        <div className="text-center">
          <p className="microlabel">One message, both ways</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight text-fg-strong sm:text-4xl">
            You talk to {HEAD_AGENT.defaultName}.
            <br />
            {HEAD_AGENT.defaultName} runs the army.
          </h2>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[var(--shadow-lg)]">
          <div className="node-canvas overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full min-w-[780px]"
              role="img"
              aria-label={`You message ${HEAD_AGENT.defaultName} on Telegram. It briefs all ${CREW_MEMBERS.length} agents at once, they report back, and it messages you that the work is done.`}
            >
              <defs>
                <marker
                  id="flow-arrow"
                  viewBox="0 0 8 8"
                  refX="6.5"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--line-strong)" />
                </marker>
                <marker
                  id="flow-arrow-hot"
                  viewBox="0 0 8 8"
                  refX="6.5"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--money)" />
                </marker>
              </defs>

              {/* ── The loop. Out along the top, back along the bottom. ──── */}
              <g fill="none" strokeWidth="2.5" strokeLinecap="round">
                <Wire
                  d={arc(YOU.x + YOU.w, SPINE - 14, BOSS.x, SPINE - 20, 34)}
                  hot={hot.ask}
                  label="your message"
                  lx={(YOU.x + YOU.w + BOSS.x) / 2}
                  ly={SPINE - 48}
                />
                <Wire
                  d={arc(BOSS.x + BOSS.w, SPINE - 20, CREW.x, SPINE - 26, 40)}
                  hot={hot.dispatch}
                  label="briefs all 13"
                  lx={(BOSS.x + BOSS.w + CREW.x) / 2}
                  ly={SPINE - 60}
                />
                <Wire
                  d={arc(CREW.x, SPINE + 26, BOSS.x + BOSS.w, SPINE + 20, -40)}
                  hot={hot.report}
                  label="work done"
                  lx={(BOSS.x + BOSS.w + CREW.x) / 2}
                  ly={SPINE + 76}
                />
                <Wire
                  d={arc(BOSS.x, SPINE + 20, YOU.x + YOU.w, SPINE + 14, -34)}
                  hot={hot.deliver}
                  label="your briefing"
                  lx={(YOU.x + YOU.w + BOSS.x) / 2}
                  ly={SPINE + 64}
                />
              </g>

              {/* ── You, on Telegram ─────────────────────────────────────── */}
              <g>
                <rect
                  x={YOU.x}
                  y={YOU.y}
                  width={YOU.w}
                  height={YOU.h}
                  rx={14}
                  fill="var(--surface-2)"
                  stroke={
                    phase === "ask" || phase === "done"
                      ? "var(--money)"
                      : "var(--line-strong)"
                  }
                  strokeWidth={phase === "ask" || phase === "done" ? 2.5 : 1}
                />
                <circle cx={YOU.x + 30} cy={SPINE} r="15" fill="#229ED9" />
                <path
                  d="M-7 1.5 L7 -5.5 L4.2 6 L0.4 2.6 L-2.2 5 L-1.9 1.2 Z"
                  transform={`translate(${YOU.x + 30} ${SPINE})`}
                  fill="#fff"
                />
                <text
                  x={YOU.x + 54}
                  y={SPINE - 4}
                  fontSize="14"
                  fontWeight="700"
                  fill="var(--fg-strong)"
                >
                  You
                </text>
                <text x={YOU.x + 54} y={SPINE + 12} fontSize="11" fill="var(--muted)">
                  on Telegram
                </text>
              </g>

              {/* ── Seamus ───────────────────────────────────────────────── */}
              <g>
                {phase !== "done" ? (
                  <rect
                    x={BOSS.x - 5}
                    y={BOSS.y - 5}
                    width={BOSS.w + 10}
                    height={BOSS.h + 10}
                    rx={18}
                    fill="var(--accent-wash)"
                    stroke="var(--accent-line)"
                  />
                ) : null}
                <rect
                  x={BOSS.x}
                  y={BOSS.y}
                  width={BOSS.w}
                  height={BOSS.h}
                  rx={14}
                  fill="var(--surface-2)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
                <g transform={`translate(${BOSS.x + 12} ${SPINE - 34}) scale(0.79)`}>
                  <AgentFace seed={HEAD_AGENT.id} commander uid="flow" />
                </g>
                <text
                  x={BOSS.x + 62}
                  y={SPINE - 10}
                  fontSize="15"
                  fontWeight="800"
                  fill="var(--fg-strong)"
                >
                  {HEAD_AGENT.defaultName}
                </text>
                <text x={BOSS.x + 62} y={SPINE + 5} fontSize="11" fill="var(--muted)">
                  head agent
                </text>
                <text
                  x={BOSS.x + 12}
                  y={SPINE + 34}
                  fontSize="10.5"
                  fill={phase === "done" ? "var(--live)" : "var(--faint)"}
                >
                  {phase === "done" ? "briefing sent" : "coordinating"}
                </text>
              </g>

              {/* ── The army, all at once ────────────────────────────────── */}
              <rect
                x={CREW.x}
                y={CREW.y}
                width={CREW.w}
                height={CREW.h}
                rx={16}
                fill="var(--surface-2)"
                stroke={crewBusy ? "var(--money-line)" : "var(--line)"}
                strokeWidth={crewBusy ? 2 : 1}
              />
              <text
                x={CREW.x + 14}
                y={CREW.y + 18}
                fontSize="10.5"
                fontWeight="700"
                fill="var(--faint)"
                letterSpacing="0.08em"
              >
                {crewBusy
                  ? "ALL 13 WORKING AT ONCE"
                  : crewDone
                    ? "13 DONE"
                    : "YOUR ARMY · 13 AGENTS"}
              </text>

              {CREW_MEMBERS.map((member, index) => {
                const cx = CREW.x + (index % COLS) * CELL_W + CELL_W / 2;
                const cy = CREW.y + 36 + Math.floor(index / COLS) * CELL_H;

                return (
                  <g key={member.seed}>
                    {/* The working ring. Every agent gets one, together. */}
                    {crewBusy ? (
                      <circle
                        cx={cx}
                        cy={cy + 18}
                        r="22"
                        fill="none"
                        stroke="var(--money)"
                        strokeWidth="1.5"
                        opacity="0.5"
                        className="motion-safe:animate-pulse"
                        style={{ animationDelay: `${(index % 5) * 90}ms` }}
                      />
                    ) : null}

                    <g
                      transform={`translate(${cx - 18} ${cy}) scale(0.75)`}
                      opacity={crewBusy || crewDone ? 1 : 0.55}
                      style={{ transition: "opacity 400ms" }}
                    >
                      <AgentFace seed={member.seed} uid="flow" />
                    </g>

                    {crewDone ? (
                      <>
                        <circle cx={cx + 15} cy={cy + 2} r="7" fill="var(--money)" />
                        <path
                          d={`M ${cx + 11.5} ${cy + 2} l 2.6 3 l 4.6 -5.4`}
                          fill="none"
                          stroke="var(--money-fg)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    ) : null}

                    <text
                      x={cx}
                      y={cy + 47}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="var(--fg-strong)"
                    >
                      {member.name}
                    </text>
                    <text
                      x={cx}
                      y={cy + 58}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--faint)"
                    >
                      {member.role}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* ── The phone. The loop is only real if it ends somewhere. ───── */}
          <div className="flex items-start gap-3 border-t border-line px-5 py-4">
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                CHATTER[phase].from === "you"
                  ? "bg-surface-3 text-muted"
                  : "bg-accent text-accent-fg",
              )}
            >
              {CHATTER[phase].from === "you" ? (
                "Y"
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
            </span>
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted">
              <span className="font-bold text-fg-strong">
                {CHATTER[phase].from === "you" ? "You" : HEAD_AGENT.defaultName}
              </span>{" "}
              {CHATTER[phase].text}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-faint">
          Nothing publishes, sends, or spends until you reply. Every run is
          logged.
        </p>
      </div>
    </section>
  );
}

/**
 * One wire, with its label.
 *
 * Always dashed and always moving — including the three that are not carrying
 * this beat's traffic. A graph where only the active edge animates looks like a
 * graph where the other three edges are broken.
 */
function Wire({
  d,
  hot,
  label,
  lx,
  ly,
}: {
  d: string;
  hot: boolean;
  label: string;
  lx: number;
  ly: number;
}) {
  return (
    <>
      <path
        d={d}
        stroke={hot ? "var(--money)" : "var(--line-strong)"}
        opacity={hot ? 1 : 0.62}
        className="edge-flowing"
        markerEnd={hot ? "url(#flow-arrow-hot)" : "url(#flow-arrow)"}
        style={{ transition: "opacity 300ms, stroke 300ms" }}
      />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="600"
        fill={hot ? "var(--money)" : "var(--faint)"}
        style={{ transition: "fill 300ms" }}
      >
        {label}
      </text>
    </>
  );
}
