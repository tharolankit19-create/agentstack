"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Send } from "lucide-react";
import { HEAD_AGENT, SQUADS } from "@/lib/army";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { cn } from "@/lib/utils";

/**
 * The army, running, as a node graph.
 *
 * This is the section the whole page is built around, so four rules kept it
 * from turning into a screensaver:
 *
 *   1. **It looks like a workflow, because it is one.** Dot grid, rounded
 *      nodes, bezier wires, data visibly moving down them. Everyone has seen a
 *      node editor; borrowing that vocabulary means nobody has to be told what
 *      they are looking at.
 *   2. **The graph is the real one.** Nodes are the actual squads from
 *      `army.ts`, in the order they actually run — fan out from one trigger,
 *      fan back in to the head agent, then one message. Nothing invented to
 *      fill space.
 *   3. **It ends in an outcome, not an animation.** The last beat is the
 *      Telegram message a founder would actually receive, because that is the
 *      product. A workflow diagram that loops forever without producing
 *      anything is a diagram of a product that does not.
 *   4. **It stops when nobody is watching.** An IntersectionObserver pauses
 *      the timers off-screen, and `prefers-reduced-motion` gets the finished
 *      state rather than a broken one.
 */

/* ── Canvas geometry ──────────────────────────────────────────────────────
 * One coordinate space, declared once. Everything below — nodes, wires,
 * arrowheads — derives from these, so moving a column is one number and not a
 * hunt through forty hardcoded path strings.
 */
const W = 1080;
const H = 660;

const SQUAD = { x: 330, w: 250, h: 62, gap: 102, top: 30 };
const TRIGGER = { x: 24, w: 196, h: 66 };
const HEAD = { x: 690, w: 170, h: 92 };
const OUT = { x: 910, w: 150, h: 66 };

const squadY = (index: number) => SQUAD.top + index * SQUAD.gap;
const squadMid = (index: number) => squadY(index) + SQUAD.h / 2;

/** The vertical centre line: halfway down the stack of squads. */
const SPINE = (squadY(0) + squadY(SQUADS.length - 1) + SQUAD.h) / 2;

/** A horizontal bezier between two points, the shape every node editor draws. */
function wire(x1: number, y1: number, x2: number, y2: number): string {
  const bend = Math.max((x2 - x1) * 0.5, 30);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** How long each squad appears to work. Uneven on purpose — real work is. */
const SQUAD_MS = [1500, 1300, 1100, 1400, 1700, 1200];
const COMPILE_MS = 1600;
const HOLD_MS = 5600;

type Phase = "idle" | "working" | "compiling" | "sent";

/** The message at the end. Concrete, and signed by the agent that found it. */
const BRIEFING = [
  { by: "Ida", text: "3 threads about onboarding friction. That is your angle." },
  { by: "Otis", text: "5 posts drafted, hooks rewritten twice." },
  { by: "Argus", text: "Northwind dropped their starter tier to $19." },
  { by: "Rook", text: "12 leads scored 8+, emails written." },
  { by: "Bea", text: "2 replies ready. One 2-star needs you." },
];

export function ArmyFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(-1);

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

  const total = SQUADS.length;

  useEffect(() => {
    if (reduced) {
      setStep(total + 1);
      return;
    }
    if (!visible) return;

    // Past the end: hold on the delivered message, then start over.
    if (step > total) {
      const timer = setTimeout(() => setStep(-1), HOLD_MS);
      return () => clearTimeout(timer);
    }

    const delay =
      step < 0 ? 600 : step === total ? COMPILE_MS : (SQUAD_MS[step] ?? 1300);
    const timer = setTimeout(() => setStep((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [visible, reduced, step, total]);

  const phase: Phase = useMemo(() => {
    if (step < 0) return "idle";
    if (step < total) return "working";
    if (step === total) return "compiling";
    return "sent";
  }, [step, total]);

  const active = phase === "working" ? SQUADS[step] : null;

  return (
    <section className="grid-field relative border-b border-line px-5 py-16 sm:py-24">
      <div ref={containerRef} className="relative mx-auto max-w-6xl">
        <div className="text-center">
          <p className="microlabel">Every morning, before you wake up</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-fg-strong sm:text-5xl">
            Six squads run.
            <br />
            One message arrives.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            No canvas to wire, no nodes to drag, no credits to top up. This is
            the workflow, and it is already built.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[var(--shadow-lg)]">
          {/* The editor chrome. It is the frame that says "running", and it is
              the only place the state is written in words. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-surface-3" />
              <span className="size-2.5 rounded-full bg-surface-3" />
              <span className="size-2.5 rounded-full bg-surface-3" />
            </span>
            <span className="ml-1 text-sm font-bold text-fg-strong">
              Your marketing army
            </span>
            <span className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-faint">
              {SQUADS.length + 1} nodes · 14 agents
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs font-semibold">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  phase === "sent" ? "bg-live" : "bg-money",
                  phase !== "sent" && "motion-safe:animate-pulse",
                )}
              />
              <span className={phase === "sent" ? "text-live" : "text-money"}>
                {phase === "sent" ? "Delivered" : "Executing"}
              </span>
            </span>
          </div>

          {/* The canvas. Wide by nature, so it scrolls inside itself rather
              than forcing the page sideways on a phone. */}
          <div className="node-canvas overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full min-w-[860px]"
              role="img"
              aria-label={`A workflow: a daily trigger fans out to ${SQUADS.length} squads, which report into the head agent, which sends one Telegram message.`}
            >
              <defs>
                <marker
                  id="wire-arrow"
                  viewBox="0 0 8 8"
                  refX="6"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--line-strong)" />
                </marker>
              </defs>

              {/* ── Wires, under the nodes ──────────────────────────────── */}
              <g fill="none" strokeWidth="2" strokeLinecap="round">
                {SQUADS.map((squad, index) => {
                  const running = step === index;
                  const done = step > index;
                  const inbound = wire(
                    TRIGGER.x + TRIGGER.w,
                    SPINE,
                    SQUAD.x,
                    squadMid(index),
                  );
                  const outbound = wire(
                    SQUAD.x + SQUAD.w,
                    squadMid(index),
                    HEAD.x,
                    SPINE,
                  );

                  return (
                    <g key={squad.id}>
                      <path
                        d={inbound}
                        stroke={running || done ? "var(--money)" : "var(--line-strong)"}
                        className={cn(running && "edge-flowing")}
                        opacity={running || done ? 1 : 0.5}
                        markerEnd="url(#wire-arrow)"
                      />
                      <path
                        d={outbound}
                        stroke={done ? "var(--money)" : "var(--line-strong)"}
                        className={cn(done && step <= total && "edge-flowing")}
                        opacity={done ? 1 : 0.35}
                        markerEnd="url(#wire-arrow)"
                      />
                    </g>
                  );
                })}

                <path
                  d={`M ${HEAD.x + HEAD.w} ${SPINE} L ${OUT.x} ${SPINE}`}
                  stroke={phase === "sent" ? "var(--live)" : "var(--line-strong)"}
                  className={cn(phase === "compiling" && "edge-flowing")}
                  opacity={phase === "idle" || phase === "working" ? 0.35 : 1}
                  markerEnd="url(#wire-arrow)"
                />
              </g>

              {/* ── Trigger ─────────────────────────────────────────────── */}
              <Node
                x={TRIGGER.x}
                y={SPINE - TRIGGER.h / 2}
                w={TRIGGER.w}
                h={TRIGGER.h}
                icon="⏱"
                title="Daily trigger"
                subtitle="09:00 · your timezone"
                state={step >= 0 ? "done" : "idle"}
              />

              {/* ── Squads ──────────────────────────────────────────────── */}
              {SQUADS.map((squad, index) => (
                <Node
                  key={squad.id}
                  x={SQUAD.x}
                  y={squadY(index)}
                  w={SQUAD.w}
                  h={SQUAD.h}
                  icon={squad.icon}
                  title={squad.name}
                  subtitle={squad.pipeline
                    .map((sub) => sub.defaultName)
                    .join(" → ")}
                  state={step > index ? "done" : step === index ? "running" : "idle"}
                />
              ))}

              {/* ── Head agent ──────────────────────────────────────────── */}
              <Node
                x={HEAD.x}
                y={SPINE - HEAD.h / 2}
                w={HEAD.w}
                h={HEAD.h}
                icon={HEAD_AGENT.icon}
                title={HEAD_AGENT.defaultName}
                subtitle="Head Agent"
                third={
                  phase === "compiling"
                    ? "reading 6 outputs…"
                    : phase === "sent"
                      ? "briefing sent"
                      : "waiting for the squads"
                }
                state={
                  phase === "compiling"
                    ? "running"
                    : phase === "sent"
                      ? "done"
                      : "idle"
                }
              />

              {/* ── Output ──────────────────────────────────────────────── */}
              <Node
                x={OUT.x}
                y={SPINE - OUT.h / 2}
                w={OUT.w}
                h={OUT.h}
                icon="✈️"
                title="Telegram"
                subtitle="to you"
                state={phase === "sent" ? "done" : "idle"}
              />
            </svg>
          </div>

          {/* ── The payload ───────────────────────────────────────────────
              A node graph that never produces anything is a diagram. This is
              the message, and it is the entire reason the graph exists. */}
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-[1fr_1.4fr]">
            <div className="bg-surface-2 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">
                {active ? "Running now" : phase === "compiling" ? "Compiling" : "Standing by"}
              </p>

              <div className="mt-3 space-y-2">
                {(active ?? SQUADS[0]).pipeline.map((sub) => (
                  <div key={sub.defaultName} className="flex items-center gap-2.5">
                    <AgentAvatar
                      name={sub.defaultName}
                      seed={sub.templateId ?? sub.defaultName}
                      size={26}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-tight text-fg-strong">
                        {sub.defaultName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {sub.name}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                {active ? active.mission : "Every agent has a name, a job, and a log you can read."}
              </p>
            </div>

            <div className="bg-surface-2 p-5">
              <div
                className={cn(
                  "rounded-xl border border-line bg-surface p-4 transition-all duration-700",
                  phase === "sent"
                    ? "translate-y-0 opacity-100"
                    : "translate-y-2 opacity-30",
                )}
              >
                <p className="flex items-center gap-2 text-xs font-bold text-live">
                  <Send className="size-3.5" aria-hidden />
                  Telegram · 9:00am
                </p>

                <p className="mt-2.5 text-[13px] font-semibold text-fg-strong">
                  Morning. Here is today.
                </p>

                <ul className="mt-2 space-y-1.5">
                  {BRIEFING.map((line, index) => (
                    <li
                      key={line.by}
                      className="text-[12px] leading-relaxed text-muted transition-all duration-500"
                      style={{
                        transitionDelay: phase === "sent" ? `${index * 90}ms` : "0ms",
                        opacity: phase === "sent" ? 1 : 0,
                      }}
                    >
                      <span className="font-semibold text-fg">{line.by}:</span>{" "}
                      {line.text}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[12px] text-muted">
                  {phase === "sent" ? (
                    <Check className="size-3.5 shrink-0 text-live" strokeWidth={3} />
                  ) : null}
                  Reply <span className="font-bold text-fg">1</span> to approve all
                  · <span className="font-bold text-fg">2</span> for detail ·{" "}
                  <span className="font-bold text-fg">skip</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-faint">
          Nothing publishes, sends, or spends until you reply. Every run is
          logged.
        </p>
      </div>
    </section>
  );
}

type NodeState = "idle" | "running" | "done";

/**
 * One node on the canvas.
 *
 * Drawn in SVG rather than positioned HTML because the wires are SVG, and
 * keeping both in one coordinate space is what stops the arrows from drifting
 * off the boxes at every breakpoint. Text included — a node whose label lives
 * in a separate layer is a node that will one day be half a pixel out.
 */
function Node({
  x,
  y,
  w,
  h,
  icon,
  title,
  subtitle,
  third,
  state,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  icon: string;
  title: string;
  subtitle: string;
  third?: string;
  state: NodeState;
}) {
  const border =
    state === "running"
      ? "var(--money)"
      : state === "done"
        ? "var(--line-strong)"
        : "var(--line)";

  return (
    <g opacity={state === "idle" ? 0.6 : 1} style={{ transition: "opacity 400ms" }}>
      {/* The glow that says this one is working. */}
      {state === "running" ? (
        <rect
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={h + 8}
          rx={16}
          fill="var(--money-wash)"
          stroke="var(--money-line)"
          strokeWidth="1"
        />
      ) : null}

      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill="var(--surface-2)"
        stroke={border}
        strokeWidth={state === "running" ? 2 : 1}
      />

      {/* Icon tile, left-aligned, the way every node editor does it. */}
      <rect
        x={x + 11}
        y={y + h / 2 - 16}
        width={32}
        height={32}
        rx={9}
        fill="var(--surface-3)"
      />
      <text
        x={x + 27}
        y={y + h / 2 + 6}
        textAnchor="middle"
        fontSize="16"
        style={{ userSelect: "none" }}
      >
        {icon}
      </text>

      <text
        x={x + 54}
        y={y + h / 2 - (third ? 10 : 2)}
        fontSize="14.5"
        fontWeight="700"
        fill="var(--fg-strong)"
      >
        {title}
      </text>
      <text
        x={x + 54}
        y={y + h / 2 + (third ? 8 : 15)}
        fontSize="11.5"
        fill="var(--muted)"
      >
        {subtitle}
      </text>
      {third ? (
        <text x={x + 54} y={y + h / 2 + 25} fontSize="11" fill="var(--faint)">
          {third}
        </text>
      ) : null}

      {/* Finished. A tick in the corner, not a colour change nobody notices. */}
      {state === "done" ? (
        <>
          <circle cx={x + w - 14} cy={y + 14} r={8} fill="var(--money)" />
          <path
            d={`M ${x + w - 18} ${y + 14} l 3 3.5 l 5.5 -6.5`}
            fill="none"
            stroke="var(--money-fg)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {state === "running" ? (
        <circle
          cx={x + w - 14}
          cy={y + 14}
          r={5}
          fill="var(--money)"
          className="motion-safe:animate-pulse"
        />
      ) : null}
    </g>
  );
}
