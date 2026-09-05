"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Clock } from "lucide-react";

/**
 * The controls that were missing.
 *
 * An agent page that shows a name, a status dot and a list of past output is a
 * profile, not a control. The founder could see that an agent existed and could
 * not make it do anything — which is the whole complaint: thirteen names and no
 * verbs.
 *
 * Three verbs, and they are the three a founder actually reaches for:
 *
 *   Run its job now, without waiting for the schedule.
 *   Give it a different job, now.
 *   Give it a job for later.
 *
 * The last two share one field because they are one thought with a different
 * ending — "audit the pricing page" and "audit the pricing page at 5pm" differ
 * by four characters, and making them two forms would make the founder choose
 * a mode before they have finished thinking.
 */
export function AgentControls({
  agentId,
  agentName,
  standingJob,
}: {
  agentId: string;
  agentName: string;
  standingJob: string | null;
}) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [when, setWhen] = useState("");
  const [pending, setPending] = useState<"now" | "custom" | "later" | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  async function run(mode: "now" | "custom") {
    setPending(mode);
    setNote(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "custom" ? { instruction } : {}),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setNote({ kind: "bad", text: payload.error ?? "That did not run." });
      } else {
        setNote({ kind: "ok", text: `${agentName} finished. The result is below.` });
        if (mode === "custom") setInstruction("");
        router.refresh();
      }
    } catch {
      setNote({ kind: "bad", text: "Could not reach the server." });
    } finally {
      setPending(null);
    }
  }

  async function schedule() {
    setPending("later");
    setNote(null);

    try {
      const response = await fetch("/api/agents/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, instruction, when }),
      });
      const payload = (await response.json()) as { error?: string; whenLabel?: string };

      if (!response.ok) {
        setNote({ kind: "bad", text: payload.error ?? "Could not schedule that." });
      } else {
        setNote({
          kind: "ok",
          text: `${agentName} will do it ${payload.whenLabel ?? "as asked"}.`,
        });
        setInstruction("");
        setWhen("");
        router.refresh();
      }
    } catch {
      setNote({ kind: "bad", text: "Could not reach the server." });
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[17px] font-bold text-fg-strong">Put {agentName} to work</h2>

      {standingJob ? (
        <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
          Its standing job: {standingJob}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void run("now")}
        disabled={busy}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-fg transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {pending === "now" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        {pending === "now" ? "Working…" : "Run its job now"}
      </button>

      <div className="mt-6 border-t border-line pt-5">
        <label
          htmlFor="agent-instruction"
          className="text-[14px] font-semibold text-fg-strong"
        >
          Or give it something specific
        </label>

        <textarea
          id="agent-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder={`Audit the pricing page and write the new title tag`}
          className="mt-2 w-full resize-y rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run("custom")}
            disabled={busy || instruction.trim().length < 5}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-[14px] font-semibold text-fg-strong disabled:opacity-50"
          >
            {pending === "custom" ? <Loader2 className="size-4 animate-spin" /> : null}
            Do it now
          </button>

          <span className="text-[13px] text-faint">or</span>

          <input
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="at 5pm / tomorrow 9am"
            aria-label="When it should run"
            className="h-10 w-44 rounded-lg border border-line bg-surface-2 px-3 text-[14px] text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
          />

          <button
            type="button"
            onClick={() => void schedule()}
            disabled={busy || instruction.trim().length < 5 || when.trim().length < 2}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-[14px] font-semibold text-fg-strong disabled:opacity-50"
          >
            {pending === "later" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Clock className="size-4" />
            )}
            Schedule it
          </button>
        </div>
      </div>

      {note ? (
        <p
          role="status"
          className={
            note.kind === "ok"
              ? "mt-4 text-[14px] font-medium text-live"
              : "mt-4 text-[14px] font-medium text-danger"
          }
        >
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
