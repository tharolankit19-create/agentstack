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
      <g color={fg}><foreignObject x="12" y="12" width="24" height="24"><div xmlns="http://www.w3.org/1999/xhtml" style={{ display: "grid", placeItems: "center", width: 24, height: 24, color: fg }}><IconFor seed={seed} size={20} /></div></foreignObject></g>
      {commander ? <path d="M18 42 H30" stroke="#fff" strokeWidth="2" strokeLinecap="round" /> : null}
    </g>
  );
}
