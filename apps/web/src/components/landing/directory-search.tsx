"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, RotateCcw, Search, X } from "lucide-react";
import { ToolIcon } from "@/components/ui/tool-icon";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { freeAlternativesFor } from "@/lib/free-alternatives";
import { VERDICT_COPY, type Replaceable, type Verdict } from "@/lib/replaceability";

/**
 * Search, filter and sort over the whole directory.
 *
 * At this size the list is a reference, and nobody reads a reference — they
 * look one thing up in it. So there are two ways in, for the two people who
 * arrive:
 *
 *   - **They know the tool.** Type its name. That is the search box, first.
 *   - **They know the pain.** "Show me every marketing tool I could drop,
 *     most expensive first." That is the type filter and the sort, and it is
 *     the question you cannot answer by searching for a product name you have
 *     not thought of yet.
 *
 * Every row is still rendered into the server HTML. The filtering is a display
 * concern; the links have to exist for a crawler that never runs any of this.
 *
 * Logos are the reason the list reads as a list of *your* subscriptions rather
 * than a spreadsheet of strings. Recognition is instant and text is not.
 */

const VERDICT_FILTERS: { verdict: Verdict | "all"; label: string }[] = [
  { verdict: "all", label: "Everything" },
  { verdict: "yes", label: "Replaceable" },
  { verdict: "partial", label: "Partly" },
  { verdict: "no", label: "Keep paying" },
];

type SortId = "alpha" | "price-asc" | "price-desc" | "verdict";

const SORTS: { id: SortId; label: string }[] = [
  { id: "alpha", label: "A–Z" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "verdict", label: "Replaceable first" },
];

const VERDICT_ORDER: Record<Verdict, number> = { yes: 0, partial: 1, no: 2 };

export function DirectorySearch({ entries }: { entries: Replaceable[] }) {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<Verdict | "all">("all");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [sort, setSort] = useState<SortId>("alpha");

  // Typing stays responsive while a list this long re-filters.
  const deferred = useDeferredValue(query);

  // Only offer types that have something in them once the other filters are
  // applied — an option that leads to an empty list is a dead end.
  const availableCategories = useMemo(() => {
    const present = new Set(entries.map((entry) => entry.category));
    return CATEGORIES.filter((option) => present.has(option.id));
  }, [entries]);

  const visible = useMemo(() => {
    const needle = deferred.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      if (verdict !== "all" && entry.verdict !== verdict) return false;
      if (category !== "all" && entry.category !== category) return false;
      if (!needle) return true;
      return (
        entry.tool.toLowerCase().includes(needle) ||
        entry.job.toLowerCase().includes(needle) ||
        // Someone who already moved to the free option should still land here.
        // The agent does the same job whether the thing underneath is Mailchimp
        // or Listmonk, so searching "listmonk" has to find that page.
        freeAlternativesFor(entry.slug).some((alternative) =>
          alternative.name.toLowerCase().includes(needle),
        )
      );
    });

    // A price of 0 means "varies too much to claim", not "free". Sorting it to
    // the top of "low to high" would be a lie in both directions, so it goes
    // last either way.
    const byPrice = (direction: 1 | -1) => (a: Replaceable, b: Replaceable) => {
      if (a.monthlyUsd === 0 && b.monthlyUsd === 0) return a.tool.localeCompare(b.tool);
      if (a.monthlyUsd === 0) return 1;
      if (b.monthlyUsd === 0) return -1;
      return (a.monthlyUsd - b.monthlyUsd) * direction || a.tool.localeCompare(b.tool);
    };

    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort(byPrice(1));
    else if (sort === "price-desc") sorted.sort(byPrice(-1));
    else if (sort === "verdict") {
      sorted.sort(
        (a, b) =>
          VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] ||
          b.monthlyUsd - a.monthlyUsd ||
          a.tool.localeCompare(b.tool),
      );
    } else sorted.sort((a, b) => a.tool.localeCompare(b.tool));

    return sorted;
  }, [entries, deferred, verdict, category, sort]);

  // What the current view is worth per month, which is the number that makes
  // someone keep filtering.
  const filteredMonthly = useMemo(
    () =>
      visible
        .filter((entry) => entry.verdict !== "no")
        .reduce((sum, entry) => sum + entry.monthlyUsd, 0),
    [visible],
  );

  const touched =
    query.trim().length > 0 || verdict !== "all" || category !== "all" || sort !== "alpha";

  function reset() {
    setQuery("");
    setVerdict("all");
    setCategory("all");
    setSort("alpha");
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 focus-within:border-accent">
        <Search className="size-4 shrink-0 text-faint" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a tool you pay for — buffer, notion, ahrefs…"
          /* Free tools match too, so someone already on Listmonk finds the
             Mailchimp page rather than an empty result. */
          aria-label="Search the directory"
          /* 16px so iOS does not zoom the whole page on focus. */
          className="w-full bg-transparent text-base text-fg outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {VERDICT_FILTERS.map((filter) => {
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
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Picker
          label="Type"
          value={category}
          onChange={(value) => setCategory(value as CategoryId | "all")}
          options={[
            { value: "all", label: "Every type" },
            ...availableCategories.map((option) => ({
              value: option.id,
              label: option.label,
            })),
          ]}
        />

        <Picker
          label="Sort"
          value={sort}
          onChange={(value) => setSort(value as SortId)}
          options={SORTS.map((option) => ({ value: option.id, label: option.label }))}
        />

        {touched ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:text-fg"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </button>
        ) : null}

        <span className="microlabel ml-auto" aria-live="polite">
          {visible.length} of {entries.length}
          {filteredMonthly > 0 ? ` · $${filteredMonthly.toLocaleString()}/mo shown` : ""}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-surface-2 px-5 py-8 text-center text-[15px] text-muted">
          Nothing here matches{" "}
          <span className="font-semibold text-fg">{query.trim() || "those filters"}</span>{" "}
          yet.
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
                <div className="flex items-start gap-3">
                  <ToolIcon
                    domain={entry.domain}
                    name={entry.tool}
                    className="mt-0.5 size-7 rounded-md"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate font-bold text-fg-strong">
                        {entry.tool}
                      </span>
                      {entry.monthlyUsd > 0 ? (
                        <span className="tnum shrink-0 text-xs font-bold text-faint">
                          ${entry.monthlyUsd}/mo
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm leading-snug text-muted">
                      {entry.job}
                    </p>
                  </div>
                </div>

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

/**
 * A labelled native select.
 *
 * Native rather than a custom menu because two of these hold thirteen options
 * and a phone's own picker beats anything we would build for that — and it
 * arrives with keyboard handling and screen-reader support already correct.
 */
function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus-within:border-accent">
      <span className="font-medium text-faint">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer bg-transparent py-0.5 font-semibold text-fg outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
