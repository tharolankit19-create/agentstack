"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The four questions, asked from inside the product instead of in front of it.
 *
 * Onboarding used to be a gate: sign up, answer four screens, then see the
 * dashboard. It converted badly for an obvious reason — someone who has just
 * signed up has seen nothing yet, so the form is a toll on a road they do not
 * know they want to be on.
 *
 * Now the dashboard opens first and this sits at the top of it. Same four
 * questions, but asked by a product they can already see, and dismissible in
 * one click. The dismissal is local only: they may well want it tomorrow, and
 * writing "no thanks" to the database to enforce that forever is a worse
 * outcome than showing a bar again on the next visit.
 */
export function OnboardingPrompt({ firstName }: { firstName: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="animate-in-up relative flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent/[0.07] p-5 pr-12">
      <ListChecks className="size-5 shrink-0 text-accent" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="font-bold text-fg-strong">
          {firstName ? `${firstName}, want this in your order?` : "Want this in your order?"}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Four questions, about thirty seconds. Tell us what you pay for and the
          library reorders around the agents that replace it.
        </p>
      </div>

      <Link href="/onboarding?next=%2Fdashboard" className="shrink-0">
        <Button size="sm">
          Answer them
          <ArrowRight />
        </Button>
      </Link>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
