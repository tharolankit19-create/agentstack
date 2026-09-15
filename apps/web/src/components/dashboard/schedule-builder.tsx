"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AgentAvatar } from "@/components/ui/agent-avatar";

export interface SchedulableAgent {
  id: string;
  name: string;
  role: string;
  templateId: string;
}

type Recurrence = "once" | "hourly" | "daily";

function defaultLocalStart(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleBuilder({ agents }: { agents: SchedulableAgent[] }) {
  const router = useRouter();
  const selectorRef = useRef<HTMLDivElement>(null);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [start, setStart] = useState(defaultLocalStart);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0] ?? null,
    [agentId, agents],
  );

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  async function create() {
    if (!agentId || !instruction.trim() || !start || pending) return;
    const parsed = new Date(start);
    if (Number.isNaN(parsed.getTime())) {
      setError("Pick a valid first-run time.");
      return;
    }

    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/agents/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId,
          instruction: instruction.trim(),
          recurrence,
          startAt: parsed.toISOString(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        task?: { run_at: string; recurrence: Recurrence };
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not schedule that.");

      setInstruction("");
      const label =
        recurrence === "once"
          ? "once"
          : recurrence === "hourly"
            ? "every hour"
            : "every day";
      setMessage(
        `${selected?.name ?? "Agent"} will run this ${label}, starting ${parsed.toLocaleString()}.`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule that.");
    } finally {
      setPending(false);
    }
  }

  if (!agents.length) return null;

  return (
    <section className="rounded-[24px] border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-fg-strong">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-fg-strong">Schedule a task</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Pick an agent, describe the outcome in plain language, and choose
            when it should run.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div ref={selectorRef} className="relative">
          <span className="text-xs font-semibold text-muted">Agent</span>
          <button
            type="button"
            onClick={() => setSelectorOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={selectorOpen}
            className="mt-2 flex h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 text-left transition hover:border-line-strong"
          >
            {selected ? (
              <AgentAvatar
                name={selected.name}
                seed={selected.templateId}
                size={30}
                commander={selected.templateId === "head-agent"}
              />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-fg-strong">
                {selected?.name ?? "Choose an agent"}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {selected?.role}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-faint" />
          </button>

          {selectorOpen ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-[82px] z-40 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl"
            >
              {agents.map((agent) => {
                const active = agent.id === agentId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setAgentId(agent.id);
                      setSelectorOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2"
                  >
                    <AgentAvatar
                      name={agent.name}
                      seed={agent.templateId}
                      size={30}
                      commander={agent.templateId === "head-agent"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-fg-strong">
                        {agent.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {agent.role}
                      </span>
                    </span>
                    {active ? <Check className="size-4 text-accent" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted">Repeat</span>
          <select
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value as Recurrence)}
            className="mt-2 h-14 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
          >
            <option value="once">Once</option>
            <option value="daily">Daily</option>
            <option value="hourly">Hourly</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold text-muted">Task</span>
        <textarea
          rows={3}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder='Example: "Find 5 SaaS founders who match our ICP and tell me why each is worth contacting."'
          className="mt-2 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-faint"
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted">First run</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
          />
        </label>

        <button
          type="button"
          onClick={() => void create()}
          disabled={pending || !agentId || instruction.trim().length < 3 || !start}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-fg-strong px-5 text-sm font-bold text-bg disabled:opacity-45"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {pending ? "Saving…" : "Schedule task"}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm font-medium text-live">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
    </section>
  );
}

export function CancelScheduledTask({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function cancel() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/agents/schedule", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void cancel()}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-fg-strong disabled:opacity-50"
    >
      {pending ? "Cancelling…" : "Cancel"}
    </button>
  );
}

export function LocalTaskTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(iso);

  useEffect(() => {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) setLabel(date.toLocaleString());
  }, [iso]);

  return <time dateTime={iso}>{label}</time>;
}
