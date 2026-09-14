import { SITE } from "@/lib/site";

export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={SITE.name} className={`shrink-0 ${className}`}>
      <path d="M11.2 4.2C11.2 2.9 12.2 2 13.5 2h5c1.3 0 2.3.9 2.3 2.2v2.1c3 1.8 4.6 5 4.6 9.1v4.7c0 6.2-3.4 9.9-9.4 9.9s-9.4-3.7-9.4-9.9v-4.7c0-4.1 1.6-7.3 4.6-9.1V4.2Z" fill="currentColor"/>
      <rect x="10.2" y="9.2" width="11.6" height="5.2" rx="2.6" fill="var(--kryx-logo-visor,#0b0d12)"/>
      <circle cx="13.7" cy="11.8" r="1.05" fill="#fff"/>
      <path d="M16.3 11.8h2.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M25 13.1c2.5.2 4 1.6 4 3.7 0 1.5-.8 2.8-2.2 3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="27.1" cy="21.6" r="1.45" fill="currentColor"/>
      <path d="M11.2 20.1c2.4 1.9 7.2 1.9 9.6 0" stroke="var(--kryx-logo-visor,#0b0d12)" strokeWidth="1.7" strokeLinecap="round" opacity=".7"/>
    </svg>
  );
}

export function LogoLockup({ className = "", showName = true, inverse = false }: { className?: string; showName?: boolean; inverse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[13px] border border-white/10 bg-[#0b0d12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_8px_18px_-12px_rgba(0,0,0,.5)] [--kryx-logo-visor:#0b0d12]">
        <LogoMark size={24} />
      </span>
      {showName ? <span className={`text-[17px] font-extrabold leading-tight tracking-tight ${inverse ? "text-white" : "text-fg-strong"}`}>{SITE.name}</span> : null}
    </span>
  );
}

export { LogoLockup as Logo };
