"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Start the one-day trial, from the showcase.
 *
 * This is the single action that turns a visitor into an operator. It starts a
 * real, payment-backed trial — one day, no feature limits, because the agents
 * run on the platform's free models so there is nothing to meter — and on
 * success it refreshes, at which point the dashboard flips from the read-only
 * showcase to the live setup.
 */
export function StartTrialButton({
  size = "lg",
  label = "Start your free trial",
}: {
  size?: "md" | "lg";
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Starter is the entry plan; the trial grants it for a day.
        body: JSON.stringify({ plan: "starter" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not start the trial.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div>
      <Button onClick={start} disabled={pending} size={size}>
        {pending ? <Loader2 className="animate-spin" /> : <Rocket />}
        {label}
      </Button>
      <p className="mt-2 text-xs text-muted">
        One day free. No card until you keep it. Cancel in one click.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
