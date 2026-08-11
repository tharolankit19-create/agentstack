"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Check, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentNote, NoteKind, PromptRevision } from "@/lib/supabase/types";

/**
 * What this agent has worked out, in the words the model actually reads.
 *
 * Two reasons this is a screen and not an implementation detail.
 *
 * The first is correction. An agent that has concluded something wrong about a
 * founder's audience will keep acting on it every morning, and the only way
 * out is for the founder to see the sentence and delete it. Memory you cannot
 * inspect is memory you cannot correct, and memory you cannot correct is a
 * bug that compounds daily.
 *
 * The second is that this is the feature. "It gets better the longer you run
 * it" is a claim every AI product makes; showing thirty specific things it
 * learned, with how many times each was confirmed, is the difference between
 * making that claim and demonstrating it.
 */

const HEADINGS: Record<NoteKind, string> = {
  style: "How you want things written",
  audience: "Your audience",
  worked: "What has worked",
  failed: "What has not worked",
  competitor: "Your competitors",
  fact: "Other established facts",
};

const ORDER: NoteKind[] = ["style", "audience", "worked", "failed", "competitor", "fact"];

export function AgentMemoryPanel({
  agentName,
  notes,
  revisions,
}: {
  agentName: string;
  notes: AgentNote[];
  revisions: PromptRevision[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const live = notes.filter((note) => !dropped.has(note.id));
  const proposals = revisions.filter((revision) => !revision.active);
  const activeRevision = revisions.find((revision) => revision.active);

  async function forget(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/agents/notes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not forget that.");
      setDropped((current) => new Set(current).add(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function setRevision(id: string, active: boolean) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/agents/revisions/${id}`, {
        method: active ? "PATCH" : "DELETE",
      });
      if (!response.ok) throw new Error("Could not change that revision.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-bold text-fg-strong">
        <Brain className="size-5 text-accent" aria-hidden />
        What {agentName} has learned
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Written down after each run and read back at the start of the next one.
        Delete anything that is wrong — it stops acting on it immediately.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {live.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          Nothing yet. It starts filling in after the first few runs, and this
          is where you will be able to read exactly what it believes.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {ORDER.map((kind) => {
            const rows = live.filter((note) => note.kind === kind);
            if (rows.length === 0) return null;

            return (
              <div
                key={kind}
                className="overflow-hidden rounded-xl border border-line bg-surface-2"
              >
                <p className="border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wider text-faint">
                  {HEADINGS[kind]}
                </p>
                <ul>
                  {rows.map((note) => (
                    <li
                      key={note.id}
                      className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-0"
                    >
                      <span className="min-w-0 flex-1 text-sm leading-relaxed text-fg">
                        {note.summary}
                      </span>

                      {/* Confidence, stated rather than implied. A lesson
                          confirmed thirty times is not the same claim as one
                          seen once, and the founder deciding what to delete
                          needs to know which is which. */}
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                          note.observations >= 10
                            ? "bg-[var(--live-wash)] text-live"
                            : note.observations >= 3
                              ? "bg-surface-3 text-muted"
                              : "text-faint",
                        )}
                        title={`Confirmed ${note.observations} times`}
                      >
                        {note.observations}×
                      </span>

                      <button
                        type="button"
                        onClick={() => forget(note.id)}
                        disabled={busy !== null}
                        aria-label="Forget this"
                        title="Forget this"
                        className="shrink-0 text-faint transition-colors hover:text-danger"
                      >
                        {busy === note.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Proposed rewrites of its own instructions. Filed, never applied. */}
      {proposals.length > 0 || activeRevision ? (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-fg-strong">
            Changes {agentName} wants to make to its own instructions
          </h3>
          <p className="mt-1 text-sm text-muted">
            Nothing here is live until you switch it on. It keeps following its
            current instructions until then.
          </p>

          <div className="mt-3 space-y-3">
            {activeRevision ? (
              <Revision
                revision={activeRevision}
                busy={busy === activeRevision.id}
                onAction={() => setRevision(activeRevision.id, false)}
                actionLabel="Revert to the original"
                active
              />
            ) : null}

            {proposals.map((revision) => (
              <Revision
                key={revision.id}
                revision={revision}
                busy={busy === revision.id}
                onAction={() => setRevision(revision.id, true)}
                actionLabel="Use this"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Revision({
  revision,
  busy,
  onAction,
  actionLabel,
  active = false,
}: {
  revision: PromptRevision;
  busy: boolean;
  onAction: () => void;
  actionLabel: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        active ? "border-live/40 bg-[var(--live-wash)]" : "border-line bg-surface-2",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-fg-strong">
        {active ? <Check className="size-4 text-live" aria-hidden /> : null}
        {revision.prompt_name} · v{revision.version}
        {active ? (
          <span className="rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--money-fg)]">
            live
          </span>
        ) : null}
      </p>

      {revision.reason ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          &ldquo;{revision.reason}&rdquo;
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          onClick={onAction}
          disabled={busy}
          size="sm"
          variant={active ? "darkOutline" : "primary"}
        >
          {busy ? <Loader2 className="animate-spin" /> : active ? <X /> : <Check />}
          {actionLabel}
        </Button>
        <Button
          onClick={() => setOpen((value) => !value)}
          variant="ghost"
          size="sm"
          className="text-muted hover:text-fg-strong"
        >
          {open ? "Hide" : "Read it"}
        </Button>
      </div>

      {open ? (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
          {revision.body}
        </pre>
      ) : null}
    </div>
  );
}
