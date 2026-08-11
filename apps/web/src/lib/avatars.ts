/**
 * A face for every agent.
 *
 * The first version hashed the agent's id into a hue and stamped two initials
 * on it. That is a good default for a system with an unbounded number of
 * entities — a Slack workspace, a git host — and the wrong answer here, because
 * there are exactly fourteen of these and the founder is supposed to know them
 * by name. Fourteen identical tiles in fourteen colours is a legend, not a
 * cast.
 *
 * So each one is specified by hand: a colour, a pair of eyes, and one piece of
 * gear that says what it does. Argus watches competitors and has three eyes.
 * Nell edits and wears a monocle. Rook hunts leads and carries a radar dish.
 * The point is not that the metaphor is deep — it is that a founder scanning a
 * sidebar can tell Otis from Bea without reading, which is the entire job of an
 * avatar.
 *
 * Specified rather than generated, deliberately. A generator would have to be
 * given the same information to produce anything better than noise, and would
 * then hide it behind a hash function nobody can edit.
 */

export type Eyes =
  | "round" // open, plain
  | "narrow" // sceptical, filters things out
  | "wide" // enthusiastic
  | "visor" // reads data, not faces
  | "triple" // watches everything
  | "star" // watches ratings
  | "soft" // handles upset people
  | "focus"; // aiming at something

export type Gear =
  | "none"
  | "headset" // talks to you
  | "antenna" // listens to the outside
  | "specs" // reads a lot
  | "monocle" // edits
  | "dish" // searches
  | "pen" // writes
  | "scissors" // cuts things up
  | "sieve"; // filters

export interface Face {
  /** Base hue. Neighbours in the roster are kept far apart. */
  hue: number;
  eyes: Eyes;
  gear: Gear;
  /** A flat mouth reads as focused; a curve reads as friendly. Both are used. */
  mouth: "smile" | "flat" | "grin";
}

/**
 * Keyed by template id, because that is what survives a rename. A founder who
 * calls their writer "Dave" still gets Otis's face, which is correct — they
 * renamed the colleague, they did not replace them.
 */
export const FACES: Record<string, Face> = {
  // The commander. Blue, headset, friendly — it is the one you talk to.
  "head-agent": { hue: 224, eyes: "round", gear: "headset", mouth: "smile" },

  // Research squad
  "research-agent": { hue: 262, eyes: "round", gear: "specs", mouth: "flat" },
  "analytics-agent": { hue: 199, eyes: "visor", gear: "none", mouth: "flat" },

  // Content squad
  "content-agent": { hue: 32, eyes: "round", gear: "pen", mouth: "grin" },
  "landing-agent": { hue: 350, eyes: "narrow", gear: "monocle", mouth: "flat" },
  "repurpose-agent": { hue: 152, eyes: "wide", gear: "scissors", mouth: "grin" },

  // Competitor intel — Argus had a hundred eyes and never slept.
  "competitor-agent": { hue: 12, eyes: "triple", gear: "none", mouth: "flat" },

  // Hype squad
  "community-agent": { hue: 288, eyes: "wide", gear: "antenna", mouth: "smile" },
  "feedback-agent": { hue: 96, eyes: "narrow", gear: "sieve", mouth: "flat" },

  // Cold outreach
  "lead-agent": { hue: 212, eyes: "focus", gear: "dish", mouth: "flat" },
  "crm-agent": { hue: 178, eyes: "narrow", gear: "sieve", mouth: "flat" },
  "outreach-agent": { hue: 52, eyes: "round", gear: "pen", mouth: "grin" },

  // Reputation
  "review-agent": { hue: 320, eyes: "star", gear: "none", mouth: "smile" },
  "inbox-agent": { hue: 136, eyes: "soft", gear: "headset", mouth: "smile" },
};

/** The fallback, for custom agents built from a customer's own tool. */
const DEFAULT_FACE: Face = { hue: 240, eyes: "round", gear: "none", mouth: "flat" };

export function faceFor(seed: string): Face {
  const known = FACES[seed];
  if (known) return known;

  // A custom agent still needs a stable identity, so its hue is derived. djb2:
  // small, stable across runs, spreads ids evenly enough.
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return { ...DEFAULT_FACE, hue: Math.abs(hash) % 360 };
}
