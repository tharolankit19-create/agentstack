import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-faint",
        accent: "bg-[var(--accent-wash)] text-[var(--accent-hover)]",
        success: "bg-[var(--live-wash)] text-live",
        warning: "bg-[var(--money-wash)] text-money",
        danger: "bg-[var(--danger-wash)] text-danger",
        darkNeutral: "bg-surface-3 text-muted",
        darkSuccess: "bg-[var(--live-wash)] text-live",
        darkWarning: "bg-[var(--money-wash)] text-money",
        darkDanger: "bg-[var(--danger-wash)] text-danger",
        darkAccent: "bg-accent/15 text-accent",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
