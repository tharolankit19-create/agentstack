"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The one call to action.
 *
 * It goes to signup, not to checkout. The paywall still holds — the dashboard
 * does not open without a subscription — but asking someone to pick a plan
 * before they have seen a single agent name loses people who would have paid
 * thirty seconds later.
 */
export function SignupButton({
  children,
  size = "lg",
  variant = "primary",
  className,
  next = "/dashboard",
}: {
  children: React.ReactNode;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  next?: string;
}) {
  const router = useRouter();

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={() =>
        router.push(`/login?mode=signup&next=${encodeURIComponent(next)}`)
      }
    >
      {children}
      <ArrowRight />
    </Button>
  );
}
