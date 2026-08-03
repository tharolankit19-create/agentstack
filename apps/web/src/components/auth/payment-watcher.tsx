"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";

/**
 * Waits for the payment webhook to land, then moves the customer on.
 *
 * Dodo's redirect and Dodo's webhook race each other. Polling for a few
 * seconds beats showing "contact support" to someone who paid 800ms ago.
 */
export function PaymentWatcher({ initiallyPaid }: { initiallyPaid: boolean }) {
  const router = useRouter();
  const [paid, setPaid] = useState(initiallyPaid);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (paid) {
      const timer = setTimeout(() => router.push("/dashboard"), 900);
      return () => clearTimeout(timer);
    }

    let attempts = 0;
    let active = true;

    const poll = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        const payload = (await response.json()) as { paid?: boolean };
        if (active && payload.paid) {
          setPaid(true);
          window.clearInterval(poll);
          return;
        }
      } catch {
        /* keep waiting — a failed poll is not a failed payment */
      }
      // ~30 seconds. Past that it is a real problem, not a slow webhook.
      if (attempts >= 15) {
        window.clearInterval(poll);
        if (active) setGaveUp(true);
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [paid, router]);

  if (paid) {
    return (
      <Button onClick={() => router.push("/dashboard")} size="lg" className="w-full">
        Pick my first agent
      </Button>
    );
  }

  if (gaveUp) {
    return (
      <div className="space-y-4 text-left">
        <p className="rounded-lg border border-[var(--money-line)] bg-[var(--money-wash)] px-4 py-3 text-sm leading-relaxed text-money">
          Your payment went through, but the confirmation has not reached us yet.
          Refresh in a minute — nothing is lost.
          {SITE.supportEmail ? (
            <>
              {" "}
              If it is still stuck, email{" "}
              <a href={`mailto:${SITE.supportEmail}`} className="underline">
                {SITE.supportEmail}
              </a>{" "}
              and it gets fixed by hand.
            </>
          ) : null}
        </p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="md"
          className="w-full"
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" />
      Confirming with the payment provider…
    </div>
  );
}
