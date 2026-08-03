"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Search, X } from "lucide-react";
import { VERDICT_COPY, type Replaceable, type Verdict } from "@/lib/replaceability";

/**
 * Search and filter over the whole directory.
 *
 * At this size the list is a reference, and nobody reads a reference — they
 * look one thing up in it. Someone arrives having thought of exactly one tool
 * they pay for, so the first thing on the page has to be a box they can type
 * its name into.
 *
 * Every row is still rendered into the server HTML. The filtering is a display
 * concern; the links have to exist for a crawler that never runs any of this.
 */

const FILTERS: { verdict: Verdict | "all"; label: string }[] = [
  { verdict: "all", label: "Everything" },
  { verdict: "yes", label: "Replaceable" },
  { verdict: "partial", label: "Partly" },
  { verdict: "no", label: "Keep paying" },
];

export function DirectorySearch({ entries }: { entries: Replaceable[] }) {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<Verdict | "all">("all");

  // Typing stays responsive while a list this long re-filters.
  const deferred = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    return entries.filter((entry) => {
      if (verdict !== "all" && entry.verdict !== verdict) return false;
      if (!needle) return true;
      return (
        entry.tool.toLowerCase().includes(needle) ||
        entry.job.toLowerCase().includes(needle)
      );
    });
  }, [entries, deferred, verdict]);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a tool you pay for — buffer, notion, ahrefs…"
          aria-label="Search the directory"
          /* 16px so iOS does not zoom the whole page on focus. */
          className="w-full bg-transparent text-base text-fg outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = verdict === filter.verdict;
          return (
            <button
              key={filter.verdict}
              type="button"
              onClick={() => setVerdict(filter.verdict)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-accent bg-[var(--accent-wash)] text-accent"
                  : "border-line text-muted hover:text-fg"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
        <span className="microlabel ml-auto">
          {visible.length} of {entries.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-surface-2 px-5 py-8 text-center text-[15px] text-muted">
          Nothing here matches{" "}
          <span className="font-semibold text-fg">{query.trim()}</span> yet.
          <br />
          On Pro you can paste that tool&rsquo;s URL and we will build the agent
          for it.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/replace/${entry.slug}`}
                className="panel-interactive group flex h-full flex-col p-4 hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-fg-strong">{entry.tool}</span>
                  {entry.monthlyUsd > 0 ? (
                    <span className="tnum shrink-0 text-xs font-bold text-faint">
                      ${entry.monthlyUsd}/mo
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 flex-1 text-sm leading-snug text-muted">
                  {entry.job}
                </p>

                <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                  <VerdictMark verdict={entry.verdict} />
                  <span className={toneFor(entry.verdict)}>
                    {VERDICT_COPY[entry.verdict].label}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toneFor(verdict: Verdict): string {
  if (verdict === "yes") return "text-live";
  if (verdict === "partial") return "text-money";
  return "text-muted";
}

function VerdictMark({ verdict }: { verdict: Verdict }) {
  const className = `size-3.5 shrink-0 ${toneFor(verdict)}`;
  if (verdict === "yes") return <Check className={className} aria-hidden />;
  if (verdict === "partial") return <Minus className={className} aria-hidden />;
  return <X className={className} aria-hidden />;
}
