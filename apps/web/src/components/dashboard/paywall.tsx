"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIST } from "@/lib/plans";
import type { PlanTier } from "@/lib/supabase/types";
import { TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * The paywall, as a moment rather than a door.
 *
 * The whole dashboard is visible after onboarding. The wall arrives when a
 * customer tries to turn something on — which is the point where they have
 * seen exactly what they are buying and picked the one they want. The server
 * still enforces it and returns 402; this is that 402 rendered as something a
 * person can act on.
 *
 * `usePaywall().guard()` wraps any action: if the response is a 402 it opens
 * this and returns false, so call sites stay one `if` long.
 */

interface PaywallState {
  open: (reason?: string) => void;
  /** Runs a fetch and opens the paywall on 402. Returns null when walled. */
  guard: <T>(run: () => Promise<Response>, reason?: string) => Promise<T | null>;
  isPaid: boolean;
}

const PaywallContext = createContext<PaywallState | null>(null);

export function usePaywall(): PaywallState {
  const context = useContext(PaywallContext);
  if (!context) {
    throw new Error("usePaywall must be used inside <PaywallProvider>.");
  }
  return context;
}

export function PaywallProvider({
  isPaid,
  children,
}: {
  isPaid: boolean;
  children: ReactNode;
}) {
  const [reason, setReason] = useState<string | null>(null);

  const open = useCallback((why?: string) => {
    setReason(why ?? "Pick a plan to turn your agents on.");
  }, []);

  const guard = useCallback(
    async <T,>(run: () => Promise<Response>, why?: string): Promise<T | null> => {
      const response = await run();

      if (response.status === 402) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setReason(payload.error ?? why ?? "Pick a plan to turn your agents on.");
        return null;
      }

      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Something went wrong.");
      }
      return payload;
    },
    [],
  );

  return (
    <PaywallContext.Provider value={{ open, guard, isPaid }}>
      {children}
      {reason ? <PaywallDialog reason={reason} onClose={() => setReason(null)} /> : null}
    </PaywallContext.Provider>
  );
}

function PaywallDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Escape closes it, and the page behind it stops scrolling while it is up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function subscribe(plan: Exclude<PlanTier, "none">) {
    setPending(plan);
    setError(null);
    try {
      // Instant access first, same as the pricing page. Someone who hit this
      // wall by clicking Deploy is exactly the person who should get to watch
      // the deploy finish before being asked for a card.
      const trial = await fetch("/api/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (trial.ok) {
        window.location.reload();
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout is unavailable right now.");
      }
      window.location.href = payload.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setPending(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a plan"
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="animate-in-up my-auto w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-fg-strong sm:text-3xl">
              {reason}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Your setup is saved. Pick a plan and this agent is live in about
              ninety seconds — replacing something you already pay more for.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg-strong"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-baseline gap-2.5 rounded-xl border border-line px-4 py-3">
          <span className="text-sm text-muted">A normal stack:</span>
          <span className="text-lg font-extrabold tabular-nums text-faint line-through">
            {formatUsd(TOTAL_MONTHLY_REPLACED)}/mo
          </span>
          <ArrowRight className="size-4 text-faint" />
          <span className="text-lg font-extrabold text-accent">$29/mo</span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PLAN_LIST.map((plan) => (
            <div
              key={plan.tier}
              className={cn(
                "rounded-xl border p-5",
                plan.highlight
                  ? "border-accent bg-accent/[0.07]"
                  : "border-line",
              )}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-fg-strong">{plan.name}</h3>
                <p className="text-2xl font-extrabold text-fg-strong">
                  ${plan.priceUsd}
                  <span className="text-sm font-medium text-muted">/mo</span>
                </p>
              </div>

              {/* The two things that separate the tiers, before the feature
                  list — nobody at a paywall reads six bullet points. */}
              <p className="mt-3 text-sm font-bold text-fg-strong">
                {plan.quotaLabel}, any from the library
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {plan.hosting === "managed"
                  ? "We host them. Nothing to deploy."
                  : "Runs on your own infrastructure and keys."}
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.slice(1, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => subscribe(plan.tier)}
                disabled={pending !== null}
                size="sm"
                variant={plan.highlight ? "primary" : "darkOutline"}
                className="mt-5 w-full"
              >
                {pending === plan.tier ? <Loader2 className="animate-spin" /> : null}
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <p className="mt-5 text-center text-xs text-faint">
          Cancel in one click. You keep everything your agents make, even after
          you stop.
        </p>
      </div>
    </div>
  );
}
