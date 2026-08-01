import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-zinc-100 text-zinc-700",
        accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-red-50 text-red-700",
        darkNeutral: "bg-zinc-800 text-zinc-300",
        darkSuccess: "bg-emerald-500/15 text-emerald-400",
        darkWarning: "bg-amber-500/15 text-amber-400",
        darkDanger: "bg-red-500/15 text-red-400",
        darkAccent: "bg-[var(--color-accent)]/15 text-[#c4b5fd]",
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
