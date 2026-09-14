import { SITE } from "@/lib/site";

/**
 * Kryx command mark.
 *
 * One head node receives the goal and fans work out to specialist nodes.
 * The geometry also hides a subtle K without becoming a generic lettermark.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={SITE.name}
      className={`shrink-0 ${className}`}
    >
      <path d="M7.5 16H14.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M17.8 14.3 23.1 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 16h6.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m17.8 17.7 5.3 5.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m16 12.8 3.2 3.2-3.2 3.2-3.2-3.2 3.2-3.2Z" fill="currentColor" />
      <circle cx="6.4" cy="16" r="2.1" fill="currentColor" />
      <rect x="22.8" y="6.8" width="4.4" height="4.4" rx="1.45" fill="currentColor" />
      <circle cx="25.2" cy="16" r="2.15" fill="currentColor" />
      <rect x="22.8" y="20.8" width="4.4" height="4.4" rx="1.45" fill="currentColor" />
    </svg>
  );
}

export function LogoLockup({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-[#0b0d12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-12px_rgba(0,0,0,.5)]">
        <LogoMark size={23} />
      </span>
      {showName ? (
        <span className="text-[17px] font-extrabold leading-tight tracking-[-.025em] text-fg-strong">
          {SITE.name}
        </span>
      ) : null}
    </span>
  );
}

export { LogoLockup as Logo };
