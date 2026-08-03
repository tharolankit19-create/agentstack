"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The plan CTA.
 *
 * Signed out, it goes to signup — asking someone to choose a plan before they
 * have seen a single agent name loses people who would have paid a minute
 * later. Signed in, it goes straight to checkout, because at that point the
 * only thing left between them and the dashboard is the card.
 */
export function PlanButton({
  plan,
  signedIn,
  children,
  size = "md",
  variant = "primary",
  className,
}: {
  plan: "starter" | "pro";
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
