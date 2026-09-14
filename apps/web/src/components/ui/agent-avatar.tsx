import { BarChart3, Bot, Crosshair, FileSearch, Megaphone, MessageSquareText, PenLine, Search, Sparkles, Target, WandSparkles } from "lucide-react";

const palette = [
  ["#111318", "#ffffff"],
  ["#5b63ff", "#ffffff"],
  ["#7b61ff", "#ffffff"],
  ["#2aa8d8", "#ffffff"],
  ["#d6a827", "#191919"],
  ["#ef5a58", "#ffffff"],
  ["#35c97e", "#072313"],
  ["#506edc", "#ffffff"],
] as const;

function hash(seed: string) {
  return Array.from(seed).reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) >>> 0), 7);
}

function IconFor({ seed, size }: { seed: string; size: number }) {
  const s = seed.toLowerCase();
  const Icon =
    s.includes("head") ? Sparkles :
    s.includes("research") || s.includes("market") ? FileSearch :
    s.includes("experiment") || s.includes("analyst") ? BarChart3 :
    s.includes("content") || s.includes("distribution") ? Megaphone :
    s.includes("search") || s.includes("seo") ? Search :
    s.includes("conversion") ? WandSparkles :
    s.includes("lead") || s.includes("hunter") ? Target :
    s.includes("outreach") ? MessageSquareText :
    s.includes("writer") ? PenLine :
    s.includes("competitor") ? Crosshair : Bot;
  return <Icon size={size} strokeWidth={2.15} />;
}

function svgGlyph(seed: string, fg: string) {
  const s = seed.toLowerCase();
  const common = { stroke: fg, strokeWidth: 2.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

  if (s.includes("head")) return <><path d="M24 13v5M24 30v5M13 24h5M30 24h5" {...common} /><path d="m18 18 3 3 6-6 3 3-6 6-3-3z" fill={fg} opacity=".92" /></>;
  if (s.includes("research") || s.includes("market")) return <><circle cx="21" cy="21" r="6.5" {...common} /><path d="m26 26 6 6" {...common} /><path d="M18.5 21h5M21 18.5v5" {...common} /></>;
  if (s.includes("experiment") || s.includes("analyst")) return <><path d="M16 31V24M23 31V18M30 31V21" {...common} /><path d="M15 34h18" {...common} /></>;
  if (s.includes("content") || s.includes("distribution")) return <><path d="M16 20h8l8-4v16l-8-4h-8z" {...common} /><path d="M17 28v5" {...common} /></>;
  if (s.includes("search") || s.includes("seo")) return <><circle cx="21" cy="21" r="6.5" {...common} /><path d="m26 26 6 6" {...common} /><path d="M18 21h6" {...common} /></>;
  if (s.includes("conversion")) return <><path d="M16 30 22 24l4 4 7-9" {...common} /><path d="M28 19h5v5" {...common} /></>;
  if (s.includes("lead") || s.includes("hunter")) return <><circle cx="24" cy="24" r="8" {...common} /><circle cx="24" cy="24" r="3" {...common} /><path d="M24 12v4M24 32v4M12 24h4M32 24h4" {...common} /></>;
  if (s.includes("outreach")) return <><path d="M15 17h18v12H22l-5 4v-4h-2z" {...common} /><path d="M19 21h10M19 25h7" {...common} /></>;
  if (s.includes("writer")) return <><path d="m16 31 3.5-7L30 13l5 5-10.5 10.5z" {...common} /><path d="m29 14 5 5" {...common} /></>;
  if (s.includes("competitor")) return <><circle cx="24" cy="24" r="8" {...common} /><path d="M24 13v4M24 31v4M13 24h4M31 24h4" {...common} /></>;
  return <><rect x="16" y="17" width="16" height="14" rx="4" {...common} /><path d="M20 23h.01M28 23h.01M20 27h8M24 13v4" {...common} /></>;
}

export function AgentAvatar({
  name,
  seed,
  size = 40,
  commander = false,
  animated = false,
  className = "",
}: {
  name: string;
  seed: string;
  size?: number;
  commander?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const [bg, fg] = commander ? palette[0] : palette[1 + (hash(seed) % (palette.length - 1))];
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden ${animated ? "agent-breathe" : ""} ${className}`}
      style={{ width: size, height: size, borderRadius: Math.max(10, Math.round(size * .31)), background: bg, color: fg, boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 5px 16px -9px rgba(0,0,0,.45)" }}
    >
      <span className="absolute inset-x-0 top-0 h-[45%] bg-white/10" aria-hidden />
      <span className="relative grid place-items-center"><IconFor seed={seed} size={Math.max(14, Math.round(size * .46))} /></span>
      {commander ? <span className="absolute bottom-[3px] h-[2px] w-[36%] rounded-full bg-white/80" aria-hidden /> : null}
    </span>
  );
}

export function AgentFace({ seed, commander = false }: { seed: string; commander?: boolean; animated?: boolean; uid?: string }) {
  const [bg, fg] = commander ? palette[0] : palette[1 + (hash(seed) % (palette.length - 1))];
  return (
    <g>
      <rect x="1" y="1" width="46" height="46" rx="14" fill={bg} />
      <path d="M2 16 Q24 2 46 16 V2 H2 Z" fill="#fff" opacity=".1" />
      <g>{svgGlyph(seed, fg)}</g>
      {commander ? <path d="M18 42 H30" stroke="#fff" strokeWidth="2" strokeLinecap="round" /> : null}
    </g>
  );
}
