type Role = "head" | "research" | "analytics" | "content" | "search" | "conversion" | "lead" | "outreach" | "generic";

function roleFor(seed: string): Role {
  const value = seed.toLowerCase();
  if (value.includes("head") || value.includes("kryx")) return "head";
  if (value.includes("research") || value.includes("market") || value.includes("competitor") || value.includes("ida")) return "research";
  if (value.includes("analytics") || value.includes("experiment") || value.includes("vera")) return "analytics";
  if (value.includes("content") || value.includes("distribution") || value.includes("writer") || value.includes("otis")) return "content";
  if (value.includes("seo") || value.includes("search") || value.includes("wren")) return "search";
  if (value.includes("landing") || value.includes("conversion") || value.includes("nell")) return "conversion";
  if (value.includes("lead") || value.includes("hunter") || value.includes("rook")) return "lead";
  if (value.includes("outreach") || value.includes("dex")) return "outreach";
  return "generic";
}

const VISUAL: Record<Role, { color: string; background: string; border: string }> = {
  head: { color: "#ffffff", background: "#315efb", border: "#315efb" },
  research: { color: "#7655e7", background: "rgba(118,85,231,.12)", border: "rgba(118,85,231,.28)" },
  analytics: { color: "#078c70", background: "rgba(7,140,112,.12)", border: "rgba(7,140,112,.28)" },
  content: { color: "#d64f70", background: "rgba(214,79,112,.12)", border: "rgba(214,79,112,.28)" },
  search: { color: "#c47a00", background: "rgba(196,122,0,.12)", border: "rgba(196,122,0,.28)" },
  conversion: { color: "#087fb5", background: "rgba(8,127,181,.12)", border: "rgba(8,127,181,.28)" },
  lead: { color: "#e05b27", background: "rgba(224,91,39,.12)", border: "rgba(224,91,39,.28)" },
  outreach: { color: "#4d63d8", background: "rgba(77,99,216,.12)", border: "rgba(77,99,216,.28)" },
  generic: { color: "var(--fg)", background: "var(--surface-3)", border: "var(--line-strong)" },
};

function RoleMark({ role }: { role: Role }) {
  if (role === "head") return <><path d="M4.5 12h5M12.5 8.5l4-4M12.5 12h5M12.5 15.5l4 4"/><path d="m11.7 7.6 4.4 4.4-4.4 4.4L7.3 12l4.4-4.4Z" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/></>;
  if (role === "research") return <><circle cx="10.5" cy="10.5" r="5.2"/><path d="m14.4 14.4 4.1 4.1M10.5 2.8v2.5M2.8 10.5h2.5"/><circle cx="10.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/></>;
  if (role === "analytics") return <><path d="M4.5 18.5V14M9.5 18.5V9.5M14.5 18.5V5M19.5 18.5V2.8"/><path d="m4 9 5-3 4 1.5 6-5"/></>;
  if (role === "content") return <><path d="M4 6.2h16M4 11.8h12M4 17.4h8"/><circle cx="18.5" cy="17.4" r="1.7" fill="currentColor" stroke="none"/></>;
  if (role === "search") return <><circle cx="12" cy="12" r="8"/><path d="m14.8 9.2-1.6 4-4 1.6 1.6-4 4-1.6Z" fill="currentColor" stroke="none"/></>;
  if (role === "conversion") return <><path d="M3.5 5h17l-6.3 7v5.2l-4.4 2V12L3.5 5Z"/><path d="m8 8 3.2 3.2L16.5 6"/></>;
  if (role === "lead") return <><circle cx="12" cy="9" r="3.4"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/><path d="M12 2.5V5M3.8 9H7M17 9h3.2"/></>;
  if (role === "outreach") return <><path d="m3.2 11.5 17.3-7-5.9 16-3.2-6-8.2-3Z"/><path d="m11.4 14.5 3.8-4"/></>;
  return <><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/></>;
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
  const role = commander ? "head" : roleFor(seed);
  const visual = VISUAL[role];
  return (
    <span
      role="img"
      aria-label={`${name}, ${role} agent`}
      title={name}
      style={{ width: size, height: size, color: visual.color, background: visual.background, borderColor: visual.border }}
      className={`grid shrink-0 place-items-center rounded-[28%] border ${animated ? "agent-breathe" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size * .62, height: size * .62 }} aria-hidden="true">
        <RoleMark role={role} />
      </svg>
    </span>
  );
}
