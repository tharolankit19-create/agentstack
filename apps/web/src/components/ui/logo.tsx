import { SITE } from "@/lib/site";

/** One incoming brief routed into three outputs: a compact, non-mascot K. */
export function LogoMark({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center bg-fg-strong text-bg ${className}`}
      style={{ width: size, height: size, borderRadius: Math.max(6, Math.round(size * 0.22)) }}
    >
      <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
        <path d="M8.5 20h9.2M22.3 16.6l7.8-7.8M22.5 20h9M22.3 23.4l7.8 7.8" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" />
        <path d="m20 14.9 5.1 5.1-5.1 5.1-5.1-5.1 5.1-5.1Z" fill="currentColor" />
        <circle cx="7.7" cy="20" r="2.5" fill="currentColor" />
        <rect x="28.6" y="6.8" width="5" height="5" rx="1.2" fill="currentColor" />
        <circle cx="31.5" cy="20" r="2.5" fill="currentColor" />
        <rect x="28.6" y="28.2" width="5" height="5" rx="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

export function LogoLockup({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={34} />
      {showName ? <span className="text-[17px] font-extrabold leading-tight tracking-[-.025em] text-fg-strong">{SITE.name}</span> : null}
    </span>
  );
}

export { LogoLockup as Logo };
