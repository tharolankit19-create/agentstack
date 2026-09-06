"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { PlanTier } from "@/lib/supabase/types";

/**
 * The plan CTA.
 *
 * Signed out, it goes to signup — asking someone to choose a plan before they
 * have seen a single agent name loses people who would have paid a minute
 * later.
 *
 * Signed in, it turns the plan on immediately rather than opening a checkout.
 * Someone who has never watched an agent run has no way to value it, and a
 * card form is a strange thing to put in front of that. They get the real
 * product for an hour, and the paywall arrives once they have seen what they
 * would be paying for.
 *
 * If the hour is already used — or instant access is switched off — this falls
 * straight back to checkout, so the button never becomes a dead end.
 */
export function PlanButton({
  plan,
  signedIn,
  children,
  size = "md",
  variant = "primary",
  className,
}: {
  plan: Exclude<PlanTier, "none">;
  signedIn: boolean;
  children: React.ReactNode;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!signedIn) {
      router.push(`/login?mode=signup&next=${encodeURIComponent(`/pricing?plan=${plan}`)}`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      // Try instant access first. A 409 means they have had their hour, which
      // is not an error worth showing — it just means checkout is the path.
      const trial = await fetch("/api/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (trial.ok) {
        // Hard navigation so the new plan is read from a fresh server render.
        window.location.assign("/dashboard?welcome=1");
        return;
      }
      if (trial.status !== 409) {
        const failure = await trial.json().catch(() => ({}));
        throw new Error(failure.error || "Could not start your trial. Please retry.");
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
        loginRequired?: boolean;
      };

      if (payload.loginRequired) {
        router.push(`/login?mode=signup&next=${encodeURIComponent("/pricing")}`);
        return;
      }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout is unavailable right now.");
      }
      window.location.href = payload.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <Button
        onClick={go}
        disabled={pending}
        size={size}
        variant={variant}
        className="w-full"
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {children}
        {pending ? null : <ArrowRight />}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
