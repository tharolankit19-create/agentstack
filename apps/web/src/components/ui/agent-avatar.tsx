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

const IMAGE_BY_ROLE: Record<Role, string> = {
  head: "/brand/kryx/agents/kryx.webp",
  research: "/brand/kryx/agents/ida.webp",
  analytics: "/brand/kryx/agents/vera.webp",
  content: "/brand/kryx/agents/otis.webp",
  search: "/brand/kryx/agents/wren.webp",
  conversion: "/brand/kryx/agents/nell.webp",
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
