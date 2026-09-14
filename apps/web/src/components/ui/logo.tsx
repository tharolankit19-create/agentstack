import { SITE } from "@/lib/site";

/**
 * Kryx's brand mascot.
 *
 * Deliberately not a letter-mark and not the Grok Bot blob. The silhouette is
 * a tall "sentinel": helmet/visor, tapered body and split base. It reads as a
 * person/leader at large sizes and still survives at favicon size.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={SITE.name} className={`shrink-0 ${className}`}>
      <path d="M10.2 4.5c0-1.2.9-2.1 2.1-2.1h7.4c1.2 0 2.1.9 2.1 2.1v2.2c2.5 1.7 4 4.5 4 8v7.1c0 4.8-3.8 7.8-9.8 7.8s-9.8-3-9.8-7.8v-7.1c0-3.5 1.5-6.3 4-8V4.5Z" fill="currentColor"/>
      <rect x="9.1" y="9.2" width="13.8" height="7.4" rx="3.7" fill="var(--kryx-visor,#0b0d12)"/>
      <path d="M12 13h5.1" stroke="var(--kryx-signal,#fff)" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="20.2" cy="12.9" r="1.25" fill="var(--kryx-signal,#fff)"/>
      <path d="M16 20.5v7.8" stroke="var(--kryx-visor,#0b0d12)" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M10.7 23.2c1.5 1.2 3.2 1.8 5.3 1.8s3.8-.6 5.3-1.8" stroke="var(--kryx-visor,#0b0d12)" strokeOpacity=".35" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

export function LogoLockup({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#0b0d12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-12px_rgba(0,0,0,.5)] [--kryx-visor:#0b0d12] [--kryx-signal:#fff]">
        <LogoMark size={24} />
      </span>
      {showName ? <span className="text-[17px] font-extrabold leading-tight tracking-tight text-fg-strong">{SITE.name}</span> : null}
    </span>
  );
}

export { LogoLockup as Logo };
