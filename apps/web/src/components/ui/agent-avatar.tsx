import { faceFor, type Face } from "@/lib/avatars";

/**
 * An agent's face.
 *
 * Drawn, not lettered. Two initials on a coloured tile is what you build when
 * there could be ten thousand of something; there are fourteen of these and the
 * founder is meant to know them by name, so each one gets eyes and a piece of
 * gear that says what it does. The specification lives in `lib/avatars.ts` — a
 * data file somebody can edit — rather than behind a hash function.
 *
 * Two exports, one drawing. `AgentAvatar` is the standalone `<svg>` for HTML.
 * `AgentFace` is the same artwork as a `<g>` in a 48×48 box, so the workflow
 * canvas can place agents inside its own coordinate space instead of nesting
 * SVGs and fighting about how they scale.
 */

export function AgentAvatar({
  name,
  seed,
  size = 40,
  /** The head agent gets a rank ring. It is the one the founder talks to. */
  commander = false,
  className = "",
}: {
  name: string;
  /** Stable identity — the template id, so renaming keeps the face. */
  seed: string;
  size?: number;
  commander?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={name}
      className={`shrink-0 ${className}`}
    >
      <AgentFace seed={seed} commander={commander} />
    </svg>
  );
}

/**
 * The artwork, in a 48×48 box, with no `<svg>` of its own.
 *
 * `uid` exists because gradients are referenced by id and two avatars of the
 * same agent on one page would otherwise declare the same one twice. Callers
 * that render an agent more than once pass a discriminator.
 */
export function AgentFace({
  seed,
  commander = false,
  uid = "",
}: {
  seed: string;
  commander?: boolean;
  uid?: string;
}) {
  const face = faceFor(seed);
  const id = `af-${seed.replace(/[^a-z0-9]/gi, "")}${uid}`;
  const skin = `hsl(${face.hue} 78% 88%)`;
  const ink = `hsl(${face.hue} 60% 18%)`;

  return (
    <g>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${face.hue} 72% 58%)`} />
          <stop offset="100%" stopColor={`hsl(${(face.hue + 30) % 360} 66% 38%)`} />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="46" height="46" rx="14" fill={`url(#${id}-bg)`} />

      {/* A soft top light, so the tile reads as an object and not a swatch. */}
      <path d="M1 16 Q24 -5 47 16 L47 1 L1 1 Z" fill="#fff" opacity="0.13" />

      {/* The head. Everything else is positioned against this. */}
      <rect x="12" y="13" width="24" height="25" rx="10" fill={skin} />

      <Gear gear={face.gear} hue={face.hue} ink={ink} />
      <Eyes eyes={face.eyes} ink={ink} />
      <Mouth mouth={face.mouth} ink={ink} />

      {commander ? (
        <>
          {/* Rank. The same three chevrons as the product mark, shrunk. */}
          <g
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M17 44 L24 40.5 L31 44" opacity="0.95" />
            <path d="M17 47 L24 43.5 L31 47" opacity="0.5" />
          </g>
          <rect
            x="3"
            y="3"
            width="42"
            height="42"
            rx="12"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        </>
      ) : null}
    </g>
  );
}

function Eyes({ eyes, ink }: { eyes: Face["eyes"]; ink: string }) {
  switch (eyes) {
    case "narrow":
      return (
        <g stroke={ink} strokeWidth="2.2" strokeLinecap="round">
          <path d="M17.5 24.5 h4" />
          <path d="M26.5 24.5 h4" />
        </g>
      );
    case "wide":
      return (
        <g fill={ink}>
          <circle cx="19.5" cy="24" r="3.1" />
          <circle cx="28.5" cy="24" r="3.1" />
          <circle cx="20.6" cy="22.9" r="1" fill="#fff" />
          <circle cx="29.6" cy="22.9" r="1" fill="#fff" />
        </g>
      );
    case "visor":
      // No eyes at all. It reads dashboards, not faces.
      return (
        <g>
          <rect x="15" y="21" width="18" height="7" rx="3.5" fill={ink} />
          <path d="M17.5 24.5 h3 l1.5 -2 l2 4 l1.5 -2 h6" stroke="#7ef0c0" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "triple":
      return (
        <g fill={ink}>
          <circle cx="18" cy="25" r="2.3" />
          <circle cx="24" cy="21.5" r="2.3" />
          <circle cx="30" cy="25" r="2.3" />
        </g>
      );
    case "star":
      return (
        <g fill={ink}>
          <circle cx="19.5" cy="24.5" r="2.4" />
          <path d="M28.5 21 l1 2.1 l2.3 .3 l-1.7 1.6 .4 2.3 -2 -1.1 -2 1.1 .4 -2.3 -1.7 -1.6 2.3 -.3 z" />
        </g>
      );
    case "soft":
      return (
        <g stroke={ink} strokeWidth="2.1" strokeLinecap="round" fill="none">
          <path d="M17 25.5 q2.3 -2.6 4.6 0" />
          <path d="M26.4 25.5 q2.3 -2.6 4.6 0" />
        </g>
      );
    case "focus":
      return (
        <g>
          <circle cx="19.5" cy="24.5" r="2.4" fill={ink} />
          <circle cx="28.5" cy="24.5" r="3.4" fill="none" stroke={ink} strokeWidth="1.5" />
          <circle cx="28.5" cy="24.5" r="1.1" fill={ink} />
        </g>
      );
    default:
      return (
        <g fill={ink}>
          <circle cx="19.5" cy="24.5" r="2.5" />
          <circle cx="28.5" cy="24.5" r="2.5" />
        </g>
      );
  }
}

function Gear({
  gear,
  hue,
  ink,
}: {
  gear: Face["gear"];
  hue: number;
  ink: string;
}) {
  const metal = `hsl(${hue} 35% 96%)`;

  switch (gear) {
    case "headset":
      return (
        <g>
          <path
            d="M11 25 V21 a13 13 0 0 1 26 0 V25"
            fill="none"
            stroke={metal}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <rect x="8.5" y="23.5" width="5" height="8" rx="2.5" fill={metal} />
          <rect x="34.5" y="23.5" width="5" height="8" rx="2.5" fill={metal} />
          {/* The mic. It is the thing that messages you. */}
          <path
            d="M11 31.5 q0 6 8 6"
            fill="none"
            stroke={metal}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="19.5" cy="37.5" r="2" fill={metal} />
        </g>
      );
    case "antenna":
      return (
        <g stroke={metal} strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M24 13 V7" />
          <circle cx="24" cy="5.5" r="2.4" fill={metal} stroke="none" />
          <path d="M18 6.5 q6 -5 12 0" opacity="0.55" />
        </g>
      );
    case "specs":
      return (
        <g fill="none" stroke={metal} strokeWidth="1.7">
          <circle cx="19.5" cy="24.5" r="4.6" />
          <circle cx="28.5" cy="24.5" r="4.6" />
          <path d="M24.1 24.5 h-.2" strokeWidth="1.7" />
          <path d="M14.9 24.5 h-2.6M33.1 24.5 h2.6" strokeLinecap="round" />
        </g>
      );
    case "monocle":
      return (
        <g fill="none" stroke={metal} strokeWidth="1.7">
          <circle cx="28.5" cy="24.5" r="5.2" />
          <path d="M31.4 28.7 l2.4 5.4" strokeLinecap="round" />
        </g>
      );
    case "dish":
      return (
        <g>
          <path
            d="M24 12 L18.5 5.5 A9 9 0 0 1 29.5 5.5 Z"
            fill={metal}
            opacity="0.92"
          />
          <path d="M24 12 V8" stroke={metal} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "pen":
      return (
        <g>
          <path
            d="M33 14 L39.5 7.5 L42 10 L35.5 16.5 Z"
            fill={metal}
          />
          <path d="M33 14 L35.5 16.5 L32 17.5 Z" fill={ink} />
        </g>
      );
    case "scissors":
      return (
        <g stroke={metal} strokeWidth="1.7" fill="none" strokeLinecap="round">
          <path d="M33 6.5 L40 15" />
          <path d="M40 6.5 L33 15" />
          <circle cx="32.4" cy="16" r="1.9" />
          <circle cx="40.6" cy="16" r="1.9" />
        </g>
      );
    case "sieve":
      return (
        <g>
          <path
            d="M14 10 H34 L27 18 V24 L21 27 V18 Z"
            fill={metal}
            opacity="0.9"
          />
        </g>
      );
    default:
      return null;
  }
}

function Mouth({ mouth, ink }: { mouth: Face["mouth"]; ink: string }) {
  if (mouth === "grin") {
    return (
      <path
        d="M20 30.5 q4 4 8 0 z"
        fill={ink}
        stroke={ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    );
  }
  if (mouth === "smile") {
    return (
      <path
        d="M20.5 30.5 q3.5 3.2 7 0"
        fill="none"
        stroke={ink}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    );
  }
  return (
    <path
      d="M21 31.5 h6"
      fill="none"
      stroke={ink}
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  );
}
