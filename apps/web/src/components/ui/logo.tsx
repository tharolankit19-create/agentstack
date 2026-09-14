import { SITE } from "@/lib/site";

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={SITE.name} className={`shrink-0 ${className}`}>
      <path d="M5.5 18.7C5.5 10.3 10.2 5.4 18 5.4c5.1 0 8.5 1.9 9.8 5.5.7 2 .6 4.4-.2 7-1.4 4.6-5.4 8.6-11.4 8.6-6.8 0-10.7-2.7-10.7-7.8Z" fill="currentColor"/>
      <path d="M12.2 14.2 15 19.8" stroke="var(--logo-eye,#0b0d12)" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="m20 13.1 2.6 5.3" stroke="var(--logo-eye,#0b0d12)" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M8.3 10.3c3.2-3 8.7-4.4 13.2-2.7" stroke="currentColor" strokeOpacity=".32" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

export function LogoLockup({ className = "", showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-[#0b0d12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-12px_rgba(0,0,0,.5)] [--logo-eye:#0b0d12]">
        <LogoMark size={24} />
      </span>
      {showName ? <span className="text-[17px] font-extrabold leading-tight tracking-tight text-fg-strong">{SITE.name}</span> : null}
    </span>
  );
}

export { LogoLockup as Logo };
