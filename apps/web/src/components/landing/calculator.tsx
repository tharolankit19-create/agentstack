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
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white">
      <div className="border-b border-[var(--color-line)] px-5 py-4 sm:px-6">
        <p className="text-sm font-bold text-[var(--color-ink)]">
          Tick the tools you pay for.
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          Every one of these has an agent that does its job.
        </p>
      </div>

      <div className="grid max-h-[19rem] grid-cols-1 gap-px overflow-y-auto bg-[var(--color-line)] sm:grid-cols-2">
        {TEMPLATES.map((template) => (
          <ToolRow
            key={template.id}
            template={template}
            checked={picked.has(template.id)}
            onToggle={() => toggle(template.id)}
          />
        ))}
      </div>

      <div className="border-t border-[var(--color-line)] bg-[var(--color-paper-soft)] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-soft)]">
              You pay them
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
              {formatUsd(total)}
              <span className="text-xl font-bold text-[var(--color-ink-faint)]">
                /mo
              </span>
            </p>
          </div>

          <ArrowRight className="mb-2 hidden size-6 text-[var(--color-ink-faint)] sm:block" />

          <div className="sm:text-right">
            <p className="text-sm font-medium text-[var(--color-ink-soft)]">
              You pay us
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-[var(--color-accent)] sm:text-5xl">
              ${plan.priceUsd}
              <span className="text-xl font-bold opacity-60">/mo</span>
            </p>
          </div>
        </div>

        {saved > 0 ? (
          <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-[15px] leading-relaxed">
            <span className="font-bold">
              That is {formatUsd(saved)} a month back
            </span>
            <span className="text-[var(--color-ink-soft)]">
              {" "}
              — {formatUsd(saved * 12)} a year, for {picked.size}{" "}
              {picked.size === 1 ? "tool" : "tools"} you stop paying for.
            </span>
          </p>
        ) : (
          <p className="mt-5 border-t border-[var(--color-line)] pt-4 text-[15px] text-[var(--color-ink-soft)]">
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
        "flex items-center gap-3 bg-white px-4 py-3 text-left transition-colors",
        checked ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-paper-soft)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-all",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
            : "border-[var(--color-line)] bg-white",
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {template.replaces.tools.join(" / ")}
        </span>
        <span className="block truncate text-xs text-[var(--color-ink-soft)]">
          {template.name}
        </span>
      </span>

      <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-ink-soft)]">
        ${template.replaces.monthlyUsd}
      </span>
    </button>
  );
}
