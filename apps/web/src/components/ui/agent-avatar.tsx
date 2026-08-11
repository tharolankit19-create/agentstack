/**
 * An agent's face.
 *
 * Emoji were a placeholder and read like one: 🔬 is a microscope, not a
 * researcher you have named and given a job. An agent the founder renames and
 * talks to every morning needs an identity that looks deliberate.
 *
 * So each one gets a generated mark — a monogram on a two-tone field, with the
 * hue derived from the agent's id. That means:
 *
 *   - it is stable (the same agent is the same colour forever),
 *   - it costs nothing to add an agent (no asset to draw, no file to ship),
 *   - and it survives renaming, because the colour follows the id while the
 *     letters follow whatever the founder called it.
 *
 * Inline SVG rather than an image: it inherits currentColor for the ring,
 * scales without a second asset, and adds no request.
 */

/** Distinct, readable hues. Ordered so adjacent roster agents do not collide. */
const HUES = [262, 199, 152, 32, 350, 224, 96, 12, 288, 178, 52, 320, 136, 244];

function hueFor(seed: string): number {
  // djb2. Small, stable across runs, and good enough to spread ids over 14 hues.
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return HUES[Math.abs(hash) % HUES.length];
}

/**
 * One or two letters from the name.
 *
 * Two initials when the name has two words ("Head Agent" → HA), otherwise the
 * first two characters ("Seamus" → SE). A single letter reads as an accident
 * at this size.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function AgentAvatar({
  name,
  seed,
  size = 40,
  /** The head agent gets a ring. It is the one the founder talks to. */
  commander = false,
  className = "",
}: {
  name: string;
  /** Stable identity — the template id, not the name, so renaming keeps the colour. */
  seed: string;
  size?: number;
  commander?: boolean;
  className?: string;
}) {
  const hue = hueFor(seed);
  const label = initials(name);
  const id = `ag-${seed.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={name}
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 72% 58%)`} />
          <stop offset="100%" stopColor={`hsl(${(hue + 28) % 360} 68% 42%)`} />
        </linearGradient>
      </defs>

      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="14"
        fill={`url(#${id}-fill)`}
      />

      {/* A soft highlight so the tile reads as an object rather than a swatch. */}
      <path
        d="M1 15 Q24 -4 47 15 L47 1 L1 1 Z"
        fill="#fff"
        opacity="0.14"
      />

      {commander ? (
        <rect
          x="3.5"
          y="3.5"
          width="41"
          height="41"
          rx="11.5"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
      ) : null}

      <text
        x="24"
        y="25"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={label.length > 1 ? 17 : 21}
        fontWeight="800"
        letterSpacing="0.5"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
