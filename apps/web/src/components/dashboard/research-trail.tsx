"use client";

import { useState } from "react";
import { ChevronDown, Globe, Search, Sparkles, XCircle } from "lucide-react";
import type { ResearchStep } from "@/lib/research-shared";

/**
 * What the agent actually went and looked at.
 *
 * The receipt. Without it a reply written from four freshly-read competitor
 * pages and a reply invented from nothing look identical, so a founder's only
 * rational reading of any answer is "this is probably generic" — which is
 * precisely what was being reported. Showing the work is not decoration here,
 * it is the difference between an agent you believe and one you don't.
 *
 * Collapsed to one line by default and expandable, the way ChatGPT and Grok do
 * it, because the summary is what the founder wants nine times out of ten and
 * the list is what they want on the tenth.
 *
 * Failed fetches are shown, not hidden. "I tried competitor.com and it blocked
 * me" is information; quietly dropping it leaves the founder wondering why the
 * answer skipped their biggest rival.
 */
export function ResearchTrail({ steps }: { steps: ResearchStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;

  const pages = steps.filter((s) => s.kind === "page");
  const read = pages.filter((s) => s.ok).length;
  const searches = steps.filter((s) => s.kind === "search").length;

  const summary = [
    searches ? `${searches} ${searches === 1 ? "search" : "searches"}` : null,
    pages.length ? `read ${read} of ${pages.length} pages` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-fg"
        aria-expanded={open}
      >
        <Sparkles className="size-3" aria-hidden />
        {summary || `${steps.length} steps`}
        <ChevronDown
          className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul className="mt-1.5 space-y-1 border-l border-line pl-3">
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="flex items-center gap-1.5 text-[12px]">
              {!step.ok ? (
                <XCircle className="size-3 shrink-0 text-danger" aria-hidden />
              ) : step.kind === "search" ? (
                <Search className="size-3 shrink-0 text-muted" aria-hidden />
              ) : (
                <Globe className="size-3 shrink-0 text-muted" aria-hidden />
              )}

              {step.url ? (
                <a
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`truncate hover:underline ${step.ok ? "text-muted" : "text-danger"}`}
                >
                  {step.label}
                </a>
              ) : (
                <span className={`truncate ${step.ok ? "text-muted" : "text-danger"}`}>
                  {step.label}
                </span>
              )}

              {!step.ok ? <span className="shrink-0 text-[11px] text-danger">blocked</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
