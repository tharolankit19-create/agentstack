type Role = "head" | "research" | "analytics" | "content" | "search" | "conversion" | "lead" | "outreach" | "generic";

function roleFor(seed: string): Role {
  const s = seed.toLowerCase();
  if (s.includes("head")) return "head";
  if (s.includes("research") || s.includes("market") || s.includes("competitor")) return "research";
  if (s.includes("analytics") || s.includes("experiment")) return "analytics";
  if (s.includes("content") || s.includes("distribution") || s.includes("writer")) return "content";
  if (s.includes("seo") || s.includes("search")) return "search";
  if (s.includes("landing") || s.includes("conversion")) return "conversion";
  if (s.includes("lead") || s.includes("hunter")) return "lead";
  if (s.includes("outreach")) return "outreach";
  return "generic";
}

const GLYPH: Record<Role, string> = { head: "K", research: "R", analytics: "A", content: "C", search: "S", conversion: "CV", lead: "L", outreach: "O", generic: "·" };

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
  const role = commander ? "head" : roleFor(seed);
  return (
    <span
      role="img"
      aria-label={`${name}, ${role} workstream`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * (GLYPH[role].length > 1 ? .27 : .34))) }}
      className={`grid shrink-0 place-items-center rounded-[22%] border font-mono font-bold tracking-[-.04em] ${commander ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-surface-3 text-fg-strong"} ${animated ? "agent-breathe" : ""} ${className}`}
    >
      {GLYPH[role]}
    </span>
  );
}

/** SVG form for the legacy workflow canvas. */
export function AgentFace({ seed, commander = false }: { seed: string; commander?: boolean; animated?: boolean; uid?: string }) {
  const role = commander ? "head" : roleFor(seed);
  return (
    <g>
      <rect x="1" y="1" width="46" height="46" rx="10" fill={commander ? "#c2571a" : "#232019"} stroke={commander ? "#de7b42" : "#45403a"} />
      <text x="24" y="29" textAnchor="middle" fill="#fff" fontSize={GLYPH[role].length > 1 ? "12" : "16"} fontFamily="monospace" fontWeight="700">{GLYPH[role]}</text>
    </g>
  );
}
