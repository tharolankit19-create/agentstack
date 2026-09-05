import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A button that looks like it can be pressed.
 *
 * The flat rectangle these used to be is the default of every generated
 * interface, and it costs more than looks: with no elevation there is nothing
 * to travel, so a press has no feedback beyond a colour change and the control
 * reads as a coloured label. Three things fix that, and all three are needed —
 * any one alone still reads flat:
 *
 *   a lit top edge and a seated bottom edge, so the surface has a thickness
 *   a contact shadow plus a soft cast one, so it is resting on the page
 *   travel on press, with the cast shadow collapsing as it goes down
 *
 * The radius is generous and shared through `--r-control`, so a button and the
 * input next to it cannot drift apart. Filled variants carry the elevation;
 * ghost and outline deliberately do not, because a page where everything is
 * raised has nothing raised.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--r-control)] font-semibold whitespace-nowrap [&_svg]:shrink-0 " +
    "transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-[var(--out)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] " +
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        /* The primary action is the highest-contrast thing available: white on
           the dark theme, near-black on the light one. Its label has to be
           `accent-fg` — the inverse — or it disappears into its own button. */
        primary:
          "bg-accent text-accent-fg shadow-[var(--raise)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--raise-hover)] hover:-translate-y-px active:translate-y-px active:shadow-[var(--raise-press)]",
        /* Reserved for the one place money is the action: turning an agent on. */
        money:
          "bg-money text-[var(--money-fg)] shadow-[var(--raise)] hover:brightness-105 hover:shadow-[var(--raise-hover)] hover:-translate-y-px active:translate-y-px active:shadow-[var(--raise-press)]",
        ink: "bg-[var(--fg)] text-[var(--bg)] shadow-[var(--raise)] hover:shadow-[var(--raise-hover)] hover:-translate-y-px active:translate-y-px active:shadow-[var(--raise-press)]",
        outline:
          "border border-line bg-surface text-fg shadow-[var(--shadow-sm)] hover:border-line-strong hover:bg-surface-2 hover:text-fg-strong hover:shadow-[var(--shadow)] active:translate-y-px active:shadow-none",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg active:translate-y-px",
        darkOutline:
          "border border-line bg-transparent text-fg hover:border-line-strong hover:bg-surface/60 hover:text-fg-strong active:translate-y-px",
        danger:
          "bg-danger text-[var(--danger-fg)] shadow-[var(--raise)] hover:brightness-105 hover:shadow-[var(--raise-hover)] hover:-translate-y-px active:translate-y-px active:shadow-[var(--raise-press)]",
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
