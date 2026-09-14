import { LogoMark } from "@/components/ui/logo";

type Kind = "research" | "analytics" | "content" | "search" | "conversion" | "leads" | "outreach" | "competitor" | "general";

const COLORS: Record<Kind, { bg: string; accent: string }> = {
  research: { bg: "#6d63ff", accent: "#dedbff" },
  analytics: { bg: "#267ebc", accent: "#cbeeff" },
  content: { bg: "#ef9b39", accent: "#fff0ce" },
  search: { bg: "#20a66d", accent: "#cdf6df" },
  conversion: { bg: "#e35b67", accent: "#ffd8dc" },
  leads: { bg: "#4066d8", accent: "#d6e0ff" },
  outreach: { bg: "#8d6d18", accent: "#fff0b5" },
  competitor: { bg: "#8057d6", accent: "#eadcff" },
  general: { bg: "#4d63ff", accent: "#dce2ff" },
};

function kindFor(seed: string): Kind {
  const s = seed.toLowerCase();
  if (s.includes("research") || s.includes("market")) return "research";
  if (s.includes("analytics") || s.includes("experiment")) return "analytics";
  if (s.includes("content") || s.includes("distribution")) return "content";
  if (s.includes("seo") || s.includes("search")) return "search";
  if (s.includes("landing") || s.includes("conversion")) return "conversion";
  if (s.includes("lead") || s.includes("hunter")) return "leads";
  if (s.includes("outreach")) return "outreach";
  if (s.includes("competitor")) return "competitor";
  return "general";
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
  if (commander || seed === "head-agent") {
    return (
      <span
        role="img"
        aria-label={`${name}, Chief Marketing Leader`}
        title={name}
        className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-[#0b0d12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_10px_24px_-16px_rgba(0,0,0,.55)] ${animated ? "agent-breathe" : ""} ${className}`}
        style={{ width: size, height: size }}
      >
        <LogoMark size={Math.max(18, Math.round(size * .66))} />
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${name}, AI specialist`}
      className={`shrink-0 ${animated ? "agent-breathe" : ""} ${className}`}
    >
      <SpecialistFigure kind={kindFor(seed)} />
    </svg>
  );
}

export function AgentFace({ seed, commander = false }: { seed: string; commander?: boolean; animated?: boolean; uid?: string }) {
  if (commander || seed === "head-agent") {
    return (
      <g>
        <rect x="1" y="1" width="46" height="46" rx="14" fill="#0b0d12" />
        <g transform="translate(8 7) scale(.98)">
          <path d="M11.2 4.2C11.2 2.9 12.2 2 13.5 2h5c1.3 0 2.3.9 2.3 2.2v2.1c3 1.8 4.6 5 4.6 9.1v4.7c0 6.2-3.4 9.9-9.4 9.9s-9.4-3.7-9.4-9.9v-4.7c0-4.1 1.6-7.3 4.6-9.1V4.2Z" fill="#fff"/>
          <rect x="10.2" y="9.2" width="11.6" height="5.2" rx="2.6" fill="#0b0d12"/>
          <circle cx="13.7" cy="11.8" r="1.05" fill="#fff"/>
          <path d="M16.3 11.8h2.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M25 13.1c2.5.2 4 1.6 4 3.7 0 1.5-.8 2.8-2.2 3.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          <circle cx="27.1" cy="21.6" r="1.45" fill="#fff"/>
        </g>
      </g>
    );
  }
  return <SpecialistFigure kind={kindFor(seed)} />;
}

function SpecialistFigure({ kind }: { kind: Kind }) {
  const { bg, accent } = COLORS[kind];
  return (
    <g>
      <defs>
        <linearGradient id={`agent-${kind}`} x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={bg} />
          <stop offset="1" stopColor="#151820" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill={`url(#agent-${kind})`} />
      <path d="M2 15Q24 1 46 15V2H2Z" fill="#fff" opacity=".11" />
      <ellipse cx="24" cy="39.5" rx="12" ry="3.5" fill="#11151d" opacity=".16" />
      <path d="M15 22c0-5.2 3.8-8.6 9-8.6s9 3.4 9 8.6v9.5c0 5.7-3.6 9.2-9 9.2s-9-3.5-9-9.2V22Z" fill="#f8f7f3" />
      <rect x="17.2" y="17.5" width="13.6" height="8" rx="4" fill="#17191f" />
      <circle cx="21.2" cy="21.5" r="1.35" fill={accent} />
      <path d="M25 21.5h2.8" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <path d="M20 29.7c2.2 1.5 5.8 1.5 8 0" stroke="#c8c7c3" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.3 27.3c-3.1.8-5 2.7-5.7 5.7" stroke="#f8f7f3" strokeWidth="4" strokeLinecap="round" />
      <path d="M32.7 27.3c3.1.8 5 2.7 5.7 5.7" stroke="#f8f7f3" strokeWidth="4" strokeLinecap="round" />
      <Accessory kind={kind} accent={accent} />
    </g>
  );
}

function Accessory({ kind, accent }: { kind: Kind; accent: string }) {
  if (kind === "research") return <g><circle cx="9.2" cy="34" r="4" fill="none" stroke={accent} strokeWidth="2.4"/><path d="m12.1 36.8 3 3" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/></g>;
  if (kind === "analytics") return <g><rect x="32.3" y="29" width="9" height="8" rx="2" fill="#151820"/><path d="M34.5 34v-2M37 34v-4M39.5 34v-6" stroke={accent} strokeWidth="1.4" strokeLinecap="round"/></g>;
  if (kind === "content") return <g><path d="M34 31l8-3v9l-8-3Z" fill={accent}/><rect x="31" y="31" width="5" height="4" rx="1.5" fill="#17191f"/><path d="m33.5 35 1.5 4" stroke="#17191f" strokeWidth="1.8" strokeLinecap="round"/></g>;
  if (kind === "search") return <g><circle cx="37" cy="32" r="4.3" fill="none" stroke={accent} strokeWidth="2.2"/><path d="m40.2 35.2 2.8 2.8" stroke={accent} strokeWidth="2.2" strokeLinecap="round"/><path d="M35.2 32h3.6" stroke={accent} strokeWidth="1.4" strokeLinecap="round"/></g>;
  if (kind === "conversion") return <g stroke={accent} strokeWidth="1.8" strokeLinecap="round"><path d="M34 29v10M38 29v10M42 29v10"/><circle cx="34" cy="33" r="1.8" fill="#17191f"/><circle cx="38" cy="36" r="1.8" fill="#17191f"/><circle cx="42" cy="31.5" r="1.8" fill="#17191f"/></g>;
  if (kind === "leads") return <g><circle cx="37.5" cy="33" r="6" fill="none" stroke={accent} strokeWidth="1.7"/><circle cx="37.5" cy="33" r="3.1" fill="none" stroke={accent} strokeWidth="1.7"/><circle cx="37.5" cy="33" r="1.2" fill={accent}/></g>;
  if (kind === "outreach") return <g><rect x="31.5" y="29" width="11" height="8.5" rx="2" fill={accent}/><path d="m32.8 31 4.2 3 4.2-3" stroke="#17191f" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>;
  if (kind === "competitor") return <g><circle cx="34.5" cy="32" r="3.3" fill="#17191f"/><circle cx="40.5" cy="32" r="3.3" fill="#17191f"/><path d="M37.5 32h.1" stroke={accent} strokeWidth="2"/><path d="M33 35.2 31 39M42 35.2l2 3.8" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/></g>;
  return <g><circle cx="37" cy="33" r="4" fill={accent}/><path d="M37 30.5v5M34.5 33h5" stroke="#17191f" strokeWidth="1.4" strokeLinecap="round"/></g>;
}
