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
  head: "#ffffff",
  research: "#8b7dff",
  analytics: "#57c7ff",
  content: "#ffb15f",
  search: "#43d39e",
  conversion: "#ff7187",
  lead: "#6d8cff",
  outreach: "#e2dc55",
  generic: "#c4c9d4",
};

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
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${name}, AI team member`}
      className={`shrink-0 overflow-visible ${animated ? "agent-breathe" : ""} ${className}`}
    >
      <AgentFace seed={seed} commander={commander} uid={name.replace(/[^a-z0-9]/gi, "")} />
      <title>{name}</title>
    </svg>
  );
}

/**
 * One coherent "Kryx crew" system: sculpted little workers, not people photos.
 * They share the same body/visor language, but each role has a different prop
 * and arm pose so the team feels authored rather than recoloured.
 */
export function AgentFace({
  seed,
  commander = false,
  uid = "",
}: {
  seed: string;
  commander?: boolean;
  animated?: boolean;
  uid?: string;
}) {
  const role = commander ? "head" : roleFor(seed);
  const accent = ACCENT[role];
  const id = `crew-${seed.replace(/[^a-z0-9]/gi, "")}-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#20242b" />
          <stop offset="1" stopColor="#080a0e" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill={`url(#${id})`} />
      <path d="M4 15Q24 2 44 15V4H4Z" fill="#fff" opacity=".055" />

      {/* body */}
      <path d="M18 10.5c0-2 1.6-3.5 3.5-3.5h5c1.9 0 3.5 1.5 3.5 3.5v2.2c3 1.6 4.8 4.7 4.8 8.4v8.8c0 6.1-4.2 9.7-10.8 9.7s-10.8-3.6-10.8-9.7v-8.8c0-3.7 1.8-6.8 4.8-8.4v-2.2Z" fill="#f3f4f6" />
      <rect x="16.3" y="15" width="15.4" height="8" rx="4" fill="#111318" />
      <path d="M19.4 19h4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="28" cy="19" r="1.25" fill={accent} />
      <path d="M24 28v10.2" stroke="#111318" strokeWidth="2.1" strokeLinecap="round" />

      <ArmsAndTool role={role} accent={accent} />

      {role === "head" ? (
        <>
          <path d="M15.2 15v-1.2a8.8 8.8 0 0 1 17.6 0V15" fill="none" stroke={accent} strokeWidth="1.9" strokeLinecap="round" />
          <rect x="12.7" y="16.1" width="3.4" height="7.4" rx="1.7" fill={accent} />
          <rect x="31.9" y="16.1" width="3.4" height="7.4" rx="1.7" fill={accent} />
          <path d="M14.4 23.5q0 5.2 6.5 5.2" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="21.2" cy="28.7" r="1.5" fill={accent} />
        </>
      ) : null}
    </g>
  );
}

function ArmsAndTool({ role, accent }: { role: Role; accent: string }) {
  if (role === "research") {
    return (
      <g>
        <path d="M14.8 27c-4.4 1.2-5.8 4.2-4.8 7.3" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="9.3" cy="35.5" r="4.2" fill="none" stroke={accent} strokeWidth="2" />
        <path d="m12.5 38.7 3.1 3.1" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        <path d="M33.2 27c4.1 1.1 5.5 3.8 4.8 6.8" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
      </g>
    );
  }
  if (role === "analytics") {
    return (
      <g>
        <path d="M15.1 28c-3.8 1.1-5.2 3.4-4.6 6" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M32.9 28c3.8 1.1 5.2 3.4 4.6 6" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <rect x="8.5" y="31" width="8.5" height="8" rx="2" fill="#111318" stroke={accent} strokeWidth="1.4" />
        <path d="M10.8 36.4l1.5-2 1.2 1 1.4-2.2" fill="none" stroke={accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (role === "content") {
    return (
      <g>
        <path d="M14.9 27.5c-4.4 1.6-5.7 4.3-4.4 7.5M33.1 27.5c4.2 1.2 5.7 3.9 4.4 7.3" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <path d="m8.8 37.6 8.6-8.6 2 2-8.6 8.6-3 .9Z" fill={accent} />
      </g>
    );
  }
  if (role === "search") {
    return (
      <g>
        <path d="M14.7 27.4c-4.3 1.4-5.7 4.1-4.8 7.1M33.3 27.4c4.3 1.4 5.7 4.1 4.8 7.1" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="38.4" cy="34.8" r="4.3" fill="none" stroke={accent} strokeWidth="1.8" />
        <circle cx="38.4" cy="34.8" r="1.4" fill={accent} />
        <path d="M38.4 29.3v2M33 34.8h2M41.8 34.8h2M38.4 38.2v2" stroke={accent} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    );
  }
  if (role === "conversion") {
    return (
      <g>
        <path d="M14.8 27.8c-4.2 1.1-5.8 3.6-5 6.8M33.2 27.8c4.2 1.1 5.8 3.6 5 6.8" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M8 31v-3h3M16 28h3v3M19 37v3h-3M11 40H8v-3" fill="none" stroke={accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (role === "lead") {
    return (
      <g>
        <path d="M14.8 27.5c-4.1 1.3-5.7 3.9-4.7 7.1M33.2 27.5c4.1 1.3 5.7 3.9 4.7 7.1" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="9.4" cy="35.5" r="4.8" fill="none" stroke={accent} strokeWidth="1.6" />
        <circle cx="9.4" cy="35.5" r="2.1" fill="none" stroke={accent} strokeWidth="1.3" />
        <circle cx="9.4" cy="35.5" r=".8" fill={accent} />
      </g>
    );
  }
  if (role === "outreach") {
    return (
      <g>
        <path d="M14.8 27.3c-4.1 1.4-5.5 4.1-4.6 7.1M33.2 27.3c4.1 1.4 5.5 4.1 4.6 7.1" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
        <path d="m34.5 31.2 9-3.2-3.1 9-2.1-3.1-3.8-2.7Z" fill={accent} />
      </g>
    );
  }
  return (
    <g>
      <path d="M14.8 27.5c-4.1 1.2-5.6 3.8-4.8 6.8M33.2 27.5c4.1 1.2 5.6 3.8 4.8 6.8" stroke="#f3f4f6" strokeWidth="3.2" strokeLinecap="round" />
    </g>
  );
}
