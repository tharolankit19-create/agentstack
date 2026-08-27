"use client";

import { useState } from "react";
import { Loader2, Pin, PinOff, Trash2 } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";

/**
 * The cookbook, as an editable list.
 *
 * Two actions only, because those are the two that matter: pin something the
 * agents must never forget, and delete something they got wrong. Editing prose
 * inline was tempting and left out — a founder correcting a fact is better
 * served by deleting the wrong one than by fighting a textarea.
 */

interface Entry {
  id: string;
  kind: string;
  key: string;
  title: string;
  body: string;
  sourceName: string | null;
  times_seen: number;
  pinned: boolean;
  updated_at: string;
}

const TONE: Record<string, string> = {
  worked: "bg-[var(--money-wash)] text-money",
  failed: "bg-[var(--danger-wash)] text-danger",
  competitor: "bg-[var(--kinda-wash)] text-kinda",
};

export function WikiList({ initial }: { initial: Entry[] }) {
  const [entries, setEntries] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "pin" | "delete", pinned?: boolean) {
    setBusy(id);
    try {
      const response = await fetch("/api/wiki", {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, pinned: !pinned }),
      });
      if (!response.ok) return;

      setEntries((current) =>
        action === "delete"
          ? current.filter((e) => e.id !== id)
          : current.map((e) => (e.id === id ? { ...e, pinned: !pinned } : e)),
      );
    } finally {
      setBusy(null);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-6">
        <p className="font-bold text-fg-strong">Nothing learned yet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Your agents write here as they work — a competitor&apos;s current
          price, an angle that landed, a fact about your customer. After the
          first few runs this fills up on its own, and their work gets sharper
          because of it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "rounded-xl border bg-surface p-4 transition-colors",
            entry.pinned ? "border-accent-line" : "border-line",
          )}
        >
          <div className="flex flex-wrap items-start gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                TONE[entry.kind] ?? "bg-surface-3 text-muted",
              )}
            >
              {entry.kind}
            </span>
            <p className="min-w-0 flex-1 text-sm font-bold text-fg-strong">
              {entry.title}
            </p>

            <button
              type="button"
              onClick={() => act(entry.id, "pin", entry.pinned)}
              disabled={busy === entry.id}
              aria-label={entry.pinned ? "Unpin" : "Pin"}
              title={entry.pinned ? "Unpin" : "Always tell the agents this"}
              className="shrink-0 rounded-lg p-1 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {busy === entry.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : entry.pinned ? (
                <Pin className="size-3.5 text-accent" />
              ) : (
                <PinOff className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => act(entry.id, "delete")}
              disabled={busy === entry.id}
              aria-label="Delete"
              title="This is wrong — forget it"
              className="shrink-0 rounded-lg p-1 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-muted">{entry.body}</p>

          <p className="mt-2 text-[11px] text-faint">
            {entry.sourceName ? `learned by ${entry.sourceName}` : "yours"}
            {entry.times_seen > 1 ? ` · confirmed ${entry.times_seen}×` : ""}
            {` · ${formatRelative(entry.updated_at)}`}
          </p>
        </div>
      ))}
    </div>
  );
}
