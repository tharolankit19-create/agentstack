import { SITE } from "@/lib/site";
/**
 * The mark.
 *
 * A stack of three bars, shortest at the bottom, each one a job handed off to
 * the next — and a single dot where the top bar ends, which is the agent that
 * is still running. It reads as a stack, as a bar chart of money going down,
 * and as a progress indicator, which are the three things this product is.
 *
 * Drawn on a 24-grid with 2px strokes so it stays sharp at 16px in a browser
 * tab, where most people will actually see it. No gradient: a gradient at
 * favicon size is mud.
 */
export function Logo({
  className = "size-8",
  /** The dot is the live agent. Off for flat contexts — a favicon cannot pulse. */
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label={SITE.name}
    >
      <rect width="24" height="24" rx="6" fill="var(--accent)" />
      {/* Three bars, each shorter than the one above: the stack coming down. */}
      <rect x="5" y="6.5" width="14" height="2.4" rx="1.2" fill="var(--accent-fg)" />
      <rect
        x="5"
        y="10.8"
        width="9.5"
        height="2.4"
        rx="1.2"
        fill="var(--accent-fg)"
        opacity="0.72"
      />
      <rect
        x="5"
        y="15.1"
        width="5"
        height="2.4"
        rx="1.2"
        fill="var(--accent-fg)"
        opacity="0.46"
      />
      {/* The one still running. */}
      <circle cx="17.4" cy="16.3" r="2.1" fill="var(--money)">
        {animated ? (
          <animate
            attributeName="opacity"
            values="1;0.35;1"
            dur="2s"
            repeatCount="indefinite"
          />
        ) : null}
      </circle>
    </svg>
  );
}

/** Mark plus wordmark, for the header and the login screen. */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Logo className="size-8" animated />
      <span className="text-[17px] font-bold tracking-tight text-fg-strong">
        {SITE.name}
      </span>
    </span>
  );
}
