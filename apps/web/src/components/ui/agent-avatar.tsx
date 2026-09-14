import { BarChart3, Crosshair, FileSearch, Megaphone, MessageSquareText, Search, Sparkles, Target, WandSparkles } from "lucide-react";

function RoleIcon({ seed, size = 12 }: { seed: string; size?: number }) {
  const s = seed.toLowerCase();
  const Icon = s.includes("head") ? Sparkles : s.includes("research") || s.includes("market") ? FileSearch : s.includes("experiment") || s.includes("analyst") ? BarChart3 : s.includes("content") || s.includes("distribution") ? Megaphone : s.includes("search") || s.includes("seo") ? Search : s.includes("conversion") || s.includes("landing") ? WandSparkles : s.includes("lead") || s.includes("hunter") ? Target : s.includes("outreach") ? MessageSquareText : s.includes("competitor") ? Crosshair : Sparkles;
  return <Icon size={size} strokeWidth={2.1} />;
}

export function AgentAvatar({ name, seed, size = 40, commander = false, animated = false, className = "" }: { name: string; seed: string; size?: number; commander?: boolean; animated?: boolean; className?: string; }) {
  const src = `https://i.pravatar.cc/256?u=kryxai-${encodeURIComponent(seed)}`;
  return (
    <span role="img" aria-label={`${name}, AI team member`} title={name} className={`relative inline-block shrink-0 ${animated ? "agent-breathe" : ""} ${className}`} style={{ width: size, height: size }}>
      <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ borderRadius: Math.max(12, Math.round(size * .32)), boxShadow: commander ? "0 0 0 2px var(--surface),0 0 0 3px rgba(79,107,255,.4),0 10px 24px -15px rgba(0,0,0,.5)" : "0 8px 22px -16px rgba(0,0,0,.5)" }} />
      <span aria-hidden className="absolute -bottom-1 -right-1 grid place-items-center rounded-lg border-2 border-surface bg-fg-strong text-bg" style={{ width: Math.max(18, size * .42), height: Math.max(18, size * .42) }}><RoleIcon seed={seed} size={Math.max(10, Math.round(size * .2))} /></span>
    </span>
  );
}

export function AgentFace({ seed, commander = false }: { seed: string; commander?: boolean; animated?: boolean; uid?: string }) {
  const bg = commander ? "#0b0d12" : "#f2f3f7";
  const fg = commander ? "#ffffff" : "#111318";
  return <g><rect x="1" y="1" width="46" height="46" rx="14" fill={bg} /><circle cx="24" cy="19" r="7" fill={commander ? "#f7f7f8" : "#d7d9e0"} /><path d="M12 39c1-8 6-12 12-12s11 4 12 12" fill={commander ? "#f7f7f8" : "#d7d9e0"} /><g transform="translate(30 30) scale(.55)" color={fg}><path d="M8 0v6M0 8h6M10 8h6M8 10v6" stroke={fg} strokeWidth="2.5" strokeLinecap="round" /></g></g>;
}
