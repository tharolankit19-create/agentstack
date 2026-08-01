"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The only call to action on the site.
 *
 * It goes straight to checkout. No "start free trial", no "book a demo", no
 * "join the waitlist" — asking for a card is the validation.
 */
export function BuyButton({
  plan,
  children,
  size = "lg",
  variant = "primary",
  className,
}: {
  plan: "starter" | "pro";
  children: React.ReactNode;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setPending(true);
    setError(null);
    try {
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
        window.location.href = `/login?next=${encodeURIComponent(`/pricing?plan=${plan}`)}`;
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
    <div className="flex flex-col items-start gap-2">
      <Button
        onClick={buy}
        disabled={pending}
        size={size}
        variant={variant}
        className={className}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {children}
        {pending ? null : <ArrowRight />}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
