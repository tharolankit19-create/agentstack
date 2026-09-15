type Role =
  | "head"
  | "research"
  | "analytics"
  | "content"
  | "search"
  | "conversion"
  | "lead"
  | "outreach"
  | "generic";

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

const ACCENT: Record<Role, string> = {
  head: "#b8ff3d",
  research: "#a78bfa",
  analytics: "#34d399",
  content: "#fb7185",
  search: "#fbbf24",
  conversion: "#f472b6",
  lead: "#22d3ee",
  outreach: "#fb923c",
  generic: "#d1d5db",
};

function RoleGlyph({ role, accent }: { role: Role; accent: string }) {
  switch (role) {
    case "research":
      return (
        <>
          <circle cx="34" cy="31" r="6.2" fill="none" stroke={accent} strokeWidth="3" />
          <path d="M38.6 35.6 43 40" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "analytics":
      return (
        <>
          <rect x="27" y="32" width="3.5" height="8" rx="1.6" fill={accent} />
          <rect x="32.5" y="27" width="3.5" height="13" rx="1.6" fill={accent} />
          <rect x="38" y="22" width="3.5" height="18" rx="1.6" fill={accent} />
        </>
      );
    case "content":
      return (
        <>
          <path d="M28 35 39 24l3 3-11 11-5 1 2-4Z" fill={accent} />
          <path d="M37 25.5 40 28.5" stroke="#0b0d10" strokeWidth="1.4" />
        </>
      );
    case "search":
      return <path d="m34 21 2.6 5.2 5.8.9-4.2 4 1 5.7-5.2-2.8-5.2 2.8 1-5.7-4.2-4 5.8-.9L34 21Z" fill={accent} />;
    case "conversion":
      return <path d="M27 24h15l-5.4 6.5v6.2l-4.2 2.1v-8.3L27 24Z" fill={accent} />;
    case "lead":
      return (
        <>
          <circle cx="34.5" cy="30.5" r="8" fill="none" stroke={accent} strokeWidth="2.7" />
          <circle cx="34.5" cy="30.5" r="3.1" fill={accent} />
          <path d="M40 25 43 22" stroke={accent} strokeWidth="2.7" strokeLinecap="round" />
        </>
      );
    case "outreach":
      return (
        <>
          <path d="m26 27 16-5-5 16-3.4-6.2L26 27Z" fill={accent} />
          <path d="m33.6 31.8 8.4-9.8" stroke="#0b0d10" strokeWidth="1.5" />
        </>
      );
    case "head":
      return (
        <>
          <circle cx="35" cy="28" r="3.1" fill={accent} />
          <circle cx="41" cy="35" r="2.5" fill={accent} />
          <circle cx="30" cy="39" r="2.5" fill={accent} />
          <path d="M35 31.2 40 34M34 31l-3 6" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    default:
      return <circle cx="35" cy="31" r="5.5" fill={accent} />;
  }
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
  const accent = ACCENT[role];

  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${name}, AI team member`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-[27%] shadow-[0_5px_18px_-10px_rgba(0,0,0,.55)] ${animated ? "agent-breathe" : ""} ${className}`}
    >
      <rect width="48" height="48" rx="13" fill="#0b0d10" />
      <circle cx="16" cy="15" r="11" fill={accent} opacity=".14" />
      <path d="M8.5 26.8c0-8 5.6-13.3 13.1-13.3 6.8 0 11.7 3.6 12.8 9.8-3.3-1.4-7.4-2-12.7-2-5.6 0-9.8 1.8-13.2 5.5Z" fill="#f7f7f2" />
      <rect x="9" y="19" width="25" height="16.5" rx="8" fill="#171a1f" stroke="#e8e8e3" strokeWidth="1.7" />
      <path d="M15.2 27.2c1.5-2 3.4-2 4.9 0M23.4 27.2c1.5-2 3.4-2 4.9 0" fill="none" stroke="#f8fafc" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M11.8 36.2c2.8 3.7 6.3 5.4 10.4 5.4 4 0 7.4-1.6 10.2-5.4" fill="#e8e8e3" opacity=".92" />
      <path d="M20.9 12.7v-3.1" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20.9" cy="8.2" r="2" fill={accent} />
      <RoleGlyph role={role} accent={accent} />
    </svg>
  );
}

export function AgentFace({
  seed,
  commander = false,
}: {
  seed: string;
  commander?: boolean;
  animated?: boolean;
  uid?: string;
}) {
  const role = commander ? "head" : roleFor(seed);
  const accent = ACCENT[role];

  return (
    <>
      <rect width="48" height="48" rx="13" fill="#0b0d10" />
      <path d="M8.5 27c0-8 5.6-13.5 13.1-13.5 6.8 0 11.7 3.6 12.8 9.8-3.3-1.4-7.4-2-12.7-2-5.6 0-9.8 1.8-13.2 5.7Z" fill="#f7f7f2" />
      <rect x="9" y="19" width="25" height="16.5" rx="8" fill="#171a1f" stroke="#e8e8e3" strokeWidth="1.7" />
      <path d="M15.2 27.2c1.5-2 3.4-2 4.9 0M23.4 27.2c1.5-2 3.4-2 4.9 0" fill="none" stroke="#f8fafc" strokeWidth="2.1" strokeLinecap="round" />
      <RoleGlyph role={role} accent={accent} />
    </>
  );
}
