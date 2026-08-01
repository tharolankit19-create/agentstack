import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The one violet thing on the page.
        primary:
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] active:translate-y-px",
        ink: "bg-[var(--color-ink)] text-white hover:bg-black active:translate-y-px",
        outline:
          "border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink)]",
        ghost: "text-[var(--color-ink-soft)] hover:bg-black/5 hover:text-[var(--color-ink)]",
        darkOutline:
          "border border-[var(--color-surface-line)] bg-transparent text-zinc-200 hover:border-zinc-500 hover:text-white",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-9 px-3 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-[15px] [&_svg]:size-4",
        lg: "h-14 px-8 text-lg [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
