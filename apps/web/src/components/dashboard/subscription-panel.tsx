"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/supabase/types";

/**
 * Billing, in the dashboard, where the customer can find it.
 *
 * The cancel button is real and it is one click. Burying it makes people cancel
 * by chargeback instead, which costs more than the subscription was worth.
 */
export function SubscriptionPanel({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const renews = profile.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/subscription", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not cancel.");
      setConfirming(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface-2 p-6">
      <h2 className="text-lg font-bold text-fg-strong">Billing</h2>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Plan</dt>
          <dd className="mt-0.5 font-semibold capitalize text-fg">
            {profile.plan === "none" ? "No plan" : profile.plan}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Status</dt>
          <dd className="mt-0.5 font-semibold capitalize text-fg">
            {profile.cancel_at_period_end
              ? "Cancelling"
              : profile.subscription_status.replace("_", " ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">
            {profile.cancel_at_period_end ? "Agents stop" : "Renews"}
          </dt>
          <dd className="mt-0.5 font-semibold text-fg">{renews ?? "—"}</dd>
        </div>
      </dl>

      {profile.cancel_at_period_end ? (
        <p className="mt-5 rounded-lg border border-[var(--money-line)] bg-[var(--money-wash)] px-4 py-3 text-sm leading-relaxed text-money">
          Your subscription ends {renews ? `on ${renews}` : "at the end of this period"}.
          Your agents keep running until then, and everything they made stays in
          your account either way.{" "}
          <Link href="/pricing" className="font-semibold underline">
            Resubscribe
          </Link>{" "}
          any time to turn them back on.
        </p>
      ) : (
        <div className="mt-5">
          {confirming ? (
            <div className="rounded-lg border border-line p-4">
              <p className="text-sm leading-relaxed text-muted">
                Your agents will stop {renews ? `on ${renews}` : "at the end of this period"}.
                You keep everything they have written, and your setup is saved —
                one click brings it all back.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={cancel}
                  disabled={pending}
                  variant="danger"
                  size="sm"
                >
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  Cancel my subscription
                </Button>
                <Button
                  onClick={() => setConfirming(false)}
                  variant="darkOutline"
                  size="sm"
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-muted underline transition-colors hover:text-muted"
            >
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
