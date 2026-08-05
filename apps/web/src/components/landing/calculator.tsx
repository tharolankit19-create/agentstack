"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { TEMPLATES, formatUsd, type AgentTemplate } from "@/lib/templates";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The stack calculator.
 *
 * This is the whole pitch in one interaction: tick the tools you already pay
 * for, watch the number climb, then see it next to $29. Nobody needs the
 * product explained after that.
 *
 * It is also the honest version of a demo. Every price comes from the same
 * catalog the agents are built from, so the number a visitor sees here is the
 * number the dashboard will show them after they subscribe.
 */
export function Calculator({ onPick }: { onPick?: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(
    // Three pre-ticked so the number is never zero on arrival. An empty
    // calculator asks the visitor to do work before it shows them anything.
    () => new Set(["content-agent", "review-agent", "lead-agent"]),
  );

  const total = useMemo(
    () =>
      TEMPLATES.filter((t) => picked.has(t.id)).reduce(
        (sum, t) => sum + t.replaces.monthlyUsd,
        0,
      ),
    [picked],
  );

  const plan = picked.size > 3 ? PLANS.pro : PLANS.starter;
  const saved = Math.max(total - plan.priceUsd, 0);

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onPick?.();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <p className="text-sm font-bold text-fg">
          Tick the tools you pay for.
        </p>
        <p className="mt-0.5 text-sm text-muted">
          All {TEMPLATES.length} have an agent that does their job. Scroll — the
          list is longer than you want it to be.
        </p>
      </div>

      <div className="grid max-h-[22rem] grid-cols-1 gap-px overflow-y-auto bg-line sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <ToolRow
            key={template.id}
            template={template}
            checked={picked.has(template.id)}
            onToggle={() => toggle(template.id)}
          />
        ))}
      </div>

      <div className="border-t border-line bg-surface-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              You pay them
            </p>
            {/* Coloured as a cost, not as a number. It is the only thing on
                the page the reader is currently losing, and it should look
                like it before they read the word next to it. */}
            <p className="tnum mt-1 text-4xl font-extrabold tracking-tight text-danger sm:text-5xl">
              {formatUsd(total)}
              <span className="text-xl font-bold opacity-60">/mo</span>
            </p>
          </div>

          <ArrowRight className="mb-2 hidden size-6 text-faint sm:block" />

          <div className="sm:text-right">
            <p className="text-sm font-medium text-muted">
              You pay us
            </p>
            <p className="tnum mt-1 text-4xl font-extrabold tracking-tight text-accent sm:text-5xl">
              ${plan.priceUsd}
              <span className="text-xl font-bold opacity-60">/mo</span>
            </p>
          </div>
        </div>

        {saved > 0 ? (
          <p className="mt-5 border-t border-line pt-4 text-[15px] leading-relaxed">
            <span className="font-bold text-money">
              That is {formatUsd(saved)} a month back
            </span>
            <span className="text-muted">
              {" "}
              — {formatUsd(saved * 12)} a year, for {picked.size}{" "}
              {picked.size === 1 ? "tool" : "tools"} you stop paying for.
            </span>
          </p>
        ) : (
          <p className="mt-5 border-t border-line pt-4 text-[15px] text-muted">
            Tick the tools you actually pay for to see the number.
          </p>
        )}
      </div>
    </div>
  );
}

function ToolRow({
  template,
  checked,
  onToggle,
}: {
  template: AgentTemplate;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 bg-surface px-4 py-3 text-left transition-colors",
        checked ? "bg-[var(--accent-wash)]" : "hover:bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-all",
          checked
            ? "border-accent bg-accent text-accent-fg"
            : "border-line bg-surface",
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {template.replaces.tools.join(" / ")}
        </span>
        <span className="block truncate text-xs text-muted">
          {template.name}
        </span>
      </span>

      <span className="shrink-0 text-sm font-bold tabular-nums text-muted">
        ${template.replaces.monthlyUsd}
      </span>
    </button>
  );
}
