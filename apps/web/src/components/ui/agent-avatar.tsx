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
  const s = seed.toLowerCase().trim();

  // Room mentions often know only the display name. Keep those faces stable too.
  if (s === "kryx" || s.includes("head")) return "head";
  if (s === "ida" || s.includes("research") || s.includes("market") || s.includes("competitor")) return "research";
  if (s === "vera" || s.includes("analytics") || s.includes("experiment")) return "analytics";
  if (s === "otis" || s.includes("content") || s.includes("distribution") || s.includes("writer")) return "content";
  if (s === "wren" || s.includes("seo") || s.includes("search")) return "search";
  if (s === "nell" || s.includes("landing") || s.includes("conversion")) return "conversion";
  if (s === "rook" || s.includes("lead") || s.includes("hunter")) return "lead";
  if (s === "dex" || s.includes("outreach")) return "outreach";
  return "generic";
}

const NELL_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#111"/><path d="M24 46c0-19 11-31 24-31s24 12 24 31v14c0 13-10 22-24 22S24 73 24 60V46Z" fill="#f7f7f2"/><rect x="30" y="34" width="36" height="26" rx="12" fill="#111"/><path d="M38 47c3-4 7-4 10 0M51 47c3-4 7-4 10 0" fill="none" stroke="#f7f7f2" stroke-width="4" stroke-linecap="round"/><path d="M34 18c5-8 13-10 20-7-2 6-6 10-13 13" fill="#f7f7f2"/><circle cx="69" cy="69" r="15" fill="#b8ff3d"/><path d="M62 69h13M69 62l6 7-6 7" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  );

const IMAGE_BY_ROLE: Record<Role, string> = {
  head: "/brand/kryx/agents/kryx.webp",
  research: "/brand/kryx/agents/ida.webp",
  analytics: "/brand/kryx/agents/vera.webp",
  content: "/brand/kryx/agents/otis.webp",
  search: "/brand/kryx/agents/wren.webp",
  conversion: NELL_SVG,
  lead: "/brand/kryx/agents/rook.webp",
  outreach: "/brand/kryx/agents/dex.webp",
  generic: "/brand/kryx/agents/kryx.webp",
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
    <img
      src={IMAGE_BY_ROLE[role]}
      width={size}
      height={size}
      alt={`${name}, AI team member`}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-[26%] object-cover shadow-[0_5px_18px_-10px_rgba(0,0,0,.55)] ${animated ? "agent-breathe" : ""} ${className}`}
    />
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
  return (
    <image
      href={IMAGE_BY_ROLE[role]}
      x="0"
      y="0"
      width="48"
      height="48"
      preserveAspectRatio="xMidYMid slice"
    />
  );
}
