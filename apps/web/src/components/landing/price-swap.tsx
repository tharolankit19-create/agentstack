"use client";

import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The price, as the loudest thing on the page.
 *
 * Someone lands here from a search for "Hootsuite alternative". The one number
 * that decides whether they read on is what they currently pay against what
 * this costs — so it is not a line of body copy, it is the largest element
 * above the fold, and it counts down so the eye follows it.
 *
 * The annual figure sits underneath because $99 a month is easy to ignore and
 * $1,188 a year is not.
 */
export function PriceSwap({
  toolName,
  monthlyUsd,
  ourPrice = 29,
}: {
  toolName: string;
  monthlyUsd: number;
  ourPrice?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [value, setValue] = useState(monthlyUsd);

  const saved = Math.max(monthlyUsd - ourPrice, 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      setValue(ourPrice);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        setShown(true);

        // Hold on their number first — the drop only lands if you read the
        // starting point.
        const start = performance.now() + 700;
        const duration = 900;

        const tick = (now: number) => {
          if (now < start) {
            requestAnimationFrame(tick);
            return;
          }
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(monthlyUsd - (monthlyUsd - ourPrice) * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [monthlyUsd, ourPrice]);

  if (monthlyUsd <= 0) return null;

  const dropped = value <= ourPrice;

  return (
    <div
      ref={ref}
      className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface-2"
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-5 p-6 sm:p-8">
        <div>
          <p className="text-sm font-medium text-muted">
            {toolName}, list price
          </p>
          <p
            className={cn(
              "mt-1 text-4xl font-extrabold tabular-nums tracking-tight transition-all duration-500 sm:text-5xl",
              dropped
                ? "text-faint line-through decoration-2"
                : "text-fg",
            )}
          >
            ${monthlyUsd}
            <span className="text-xl font-bold">/mo</span>
          </p>
        </div>

        <ArrowDown
          aria-hidden
          className={cn(
            "mb-3 size-6 text-faint transition-all duration-500 sm:rotate-[-90deg]",
            shown ? "opacity-100" : "opacity-0",
          )}
        />

        <div>
          <p className="text-sm font-medium text-muted">
            With {SITE.short}
          </p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-accent sm:text-5xl">
            ${value}
            <span className="text-xl font-bold opacity-60">/mo</span>
          </p>
        </div>
      </div>

      {saved > 0 ? (
        <div
          className={cn(
            "border-t border-line bg-surface px-6 py-4 transition-all duration-700 sm:px-8",
            dropped ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <p className="text-[15px] leading-relaxed">
            <span className="font-bold">
              ${saved * 12} a year back
            </span>
            <span className="text-muted">
              {" "}
              from this one subscription — and the $49 covers the other
              twenty-four agents on top of it.
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
