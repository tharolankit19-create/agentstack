"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import type { Replaceable, Verdict } from "@/lib/replaceability";
import { TEMPLATES } from "@/lib/templates";

/**
 * The leaderboard. This is the product's front page and its argument at once.
 *
 * It is a table, not a grid of cards, because the reader is doing arithmetic:
 * scanning down a column of things they pay for, looking for their own stack.
 * Cards make that scan impossible — the eye has to re-find the price in every
 * one of them. A column of right-aligned mono numbers can be read in a second.
 *
 * Selecting rows is the whole conversion mechanic. Nobody believes a headline
 * number about savings; everybody believes a number they assembled themselves
 * out of subscriptions they recognise. So the total is not claimed anywhere —
 * it is built by the visitor, one tick at a time, and the button at the bottom
 * carries their own figure back to them.
 */

const VERDICT_LABEL: Record<Verdict, string> = {
  yes: "Yes, obviously",
  partial: "Kinda",
  no: "Not really",
};

const VERDICT_CLASS: Record<Verdict, string> = {
  yes: "verdict verdict-yes",
  partial: "verdict verdict-kinda",
  no: "verdict verdict-no",
};

const FILTERS: { value: Verdict | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "yes", label: "Yes, obviously" },
  { value: "partial", label: "Kinda" },
  { value: "no", label: "Not really" },
];

type Sort = "saved" | "price" | "name";

export function AgentLeaderboard({
  entries,
  /** Where a "Make agent" click goes. Signup on the landing page, the deploy
      screen once they are already inside. */
  makeHref = "/login?mode=signup",
  /** The dashboard already has a header above it and does not need a second. */
  compact = false,
}: {
  entries: Replaceable[];
  makeHref?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const [sort, setSort] = useState<Sort>("saved");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const deferred = useDeferredValue(query);

  const rows = useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (verdict !== "all" && entry.verdict !== verdict) return false;
      if (!needle) return true;
      return (
        entry.tool.toLowerCase().includes(needle) ||
        entry.job.toLowerCase().includes(needle)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === "name") return a.tool.localeCompare(b.tool);
      if (sort === "price") return b.monthlyUsd - a.monthlyUsd;
      // Savings first: a tool we cannot replace saves nothing, so the rows
      // worth acting on float to the top on their own.
      return savedFor(b) - savedFor(a) || a.tool.localeCompare(b.tool);
    });
  }, [entries, deferred, verdict, sort]);

  const totalSaved = useMemo(() => {
    let sum = 0;
    for (const entry of entries) {
      if (picked.has(entry.slug)) sum += savedFor(entry);
    }
    return sum;
  }, [entries, picked]);

  function toggle(slug: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <div>
      {/* ---- controls ---------------------------------------------------- */}
      <div className="flex flex-col gap-3 border border-line bg-surface p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="type something you pay for — notion, buffer, ahrefs…"
            aria-label="Search the list"
            className="w-full bg-transparent font-mono text-base text-fg outline-none placeholder:text-faint sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setVerdict(filter.value)}
              aria-pressed={verdict === filter.value}
              className={`rounded border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                verdict === filter.value
                  ? "border-line-strong bg-surface-3 text-fg-strong"
                  : "border-line text-muted hover:text-fg"
              }`}
            >
              {filter.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              setSort(sort === "saved" ? "price" : sort === "price" ? "name" : "saved")
            }
            className="rounded border border-line px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-fg"
          >
            sort: {sort}
          </button>
        </div>
      </div>

      {/* ---- column headings --------------------------------------------- */}
      <div className="hidden grid-cols-[2.4rem_1.5fr_1.9fr_1fr_6.5rem_8rem_6.5rem] items-center gap-3 border-x border-b border-line bg-surface-2 px-3 py-2 lg:grid">
        <span className="microlabel">#</span>
        <span className="microlabel">Tool</span>
        <span className="microlabel">What it is for</span>
        <span className="microlabel">Replaced by</span>
        <span className="microlabel text-right">You save</span>
        <span className="microlabel">Can we agent it?</span>
        <span className="microlabel text-right">Action</span>
      </div>

      {/* ---- rows -------------------------------------------------------- */}
      {rows.length === 0 ? (
        <p className="border-x border-b border-line px-4 py-14 text-center text-sm text-muted">
          Nothing matches{" "}
          <span className="font-semibold text-fg">{query.trim()}</span> yet. On Pro
          you can paste that tool&rsquo;s URL and we build the agent for it.
        </p>
      ) : (
        <ul className="border-x border-b border-line">
          {rows.slice(0, 400).map((entry, index) => {
            const saved = savedFor(entry);
            const buildable = entry.templateId !== null;
            const isPicked = picked.has(entry.slug);

            return (
              <li
                key={entry.slug}
                className={`row grid grid-cols-[2.4rem_1fr] items-center gap-x-3 gap-y-1 px-3 py-3 lg:grid-cols-[2.4rem_1.5fr_1.9fr_1fr_6.5rem_8rem_6.5rem] ${
                  isPicked ? "bg-[var(--money-wash)]" : ""
                }`}
              >
                {/* rank / tick. Rows we cannot replace are not selectable —
                    there is nothing to add up. */}
                <span className="flex items-center">
                  {buildable ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isPicked}
                      aria-label={`Count the ${entry.tool} saving`}
                      onClick={() => toggle(entry.slug)}
                      className={`grid size-5 place-items-center rounded border transition-all ${
                        isPicked
                          ? "border-[var(--money)] bg-money text-[var(--money-fg)]"
                          : "border-line-strong bg-surface hover:border-[var(--money-line)]"
                      }`}
                    >
                      {isPicked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </button>
                  ) : (
                    <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  )}
                </span>

                <span className="min-w-0">
                  <Link
                    href={`/replace/${entry.slug}`}
                    className="block truncate font-medium text-fg-strong hover:underline"
                  >
                    {entry.tool}
                  </Link>
                  {/* On narrow screens the columns collapse, so the row has to
                      carry its own numbers inline or it says nothing. */}
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 lg:hidden">
                    {entry.monthlyUsd > 0 ? (
                      <span className="cost text-xs">${entry.monthlyUsd}/mo</span>
                    ) : null}
                    {saved > 0 ? (
                      <span className="saved text-xs">−${saved}/mo</span>
                    ) : null}
                    <span className={`${VERDICT_CLASS[entry.verdict]} !text-[9.5px]`}>
                      {VERDICT_LABEL[entry.verdict]}
                    </span>
                  </span>
                </span>

                <span className="hidden truncate text-sm text-muted lg:block">
                  {entry.job}
                </span>

                {/* Which agent picks the job up. On a "keep paying" row there
                    is none, and saying so beats an empty cell. */}
                <span className="hidden truncate lg:block">
                  {agentName(entry) ? (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                      {agentName(entry)}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                      nothing we have
                    </span>
                  )}
                </span>

                <span className="hidden text-right lg:block">
                  {saved > 0 ? (
                    <span className="saved text-base">${saved}/mo</span>
                  ) : (
                    <span className="text-sm text-faint">—</span>
                  )}
                </span>

                <span className="hidden lg:block">
                  <span className={VERDICT_CLASS[entry.verdict]}>
                    {VERDICT_LABEL[entry.verdict]}
                  </span>
                </span>

                <span className="hidden justify-end lg:flex">
                  {buildable ? (
                    <Link
                      href={makeHref}
                      className="rounded border border-line-strong px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fg transition-colors hover:border-[var(--money-line)] hover:bg-[var(--money-wash)] hover:text-money"
                    >
                      Make agent
                    </Link>
                  ) : (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                      keep it
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 400 ? (
        <p className="border-x border-b border-line px-3 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-faint">
          showing 400 of {rows.length} — search to narrow it
        </p>
      ) : null}

      {!compact ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-faint">
          {entries.length} tools · tick the ones you pay for
        </p>
      ) : null}

      {/* ---- the total they built themselves ----------------------------- */}
      {picked.size > 0 ? (
        <div className="sticky bottom-4 z-40 mt-4">
          <div className="panel-raised flex flex-wrap items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="microlabel">
                {picked.size} {picked.size === 1 ? "tool" : "tools"} ticked
              </p>
              <p className="saved mt-0.5 text-2xl sm:text-3xl">
                ${totalSaved.toLocaleString("en-US")}
                <span className="text-base opacity-70">/mo saved</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                className="font-mono text-[11px] uppercase tracking-wider text-faint hover:text-fg"
              >
                clear
              </button>
              <Link
                href={makeHref}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition-transform hover:scale-[1.02]"
              >
                Make {picked.size === 1 ? "this agent" : `these ${picked.size} agents`} →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * What ticking this row is worth per month.
 *
 * A tool we tell you to keep paying for saves nothing — claiming otherwise
 * would make the total a sales figure rather than the reader's own arithmetic,
 * and the total only persuades while it is theirs.
 */
function savedFor(entry: Replaceable): number {
  return entry.templateId && entry.verdict !== "no" ? entry.monthlyUsd : 0;
}

/** The catalog name of the agent that takes this job over, if there is one. */
function agentName(entry: Replaceable): string | null {
  if (!entry.templateId) return null;
  return TEMPLATES.find((t) => t.id === entry.templateId)?.name ?? null;
}
