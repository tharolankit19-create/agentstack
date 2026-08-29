/**
 * The gate between a model's draft and the founder's inbox.
 *
 * `looksUnusable` in chat-model catches output that is visibly broken — tool
 * calls, refusals, nothing at all. This catches the subtler failure, the one
 * that actually loses customers: output that is well-formed, grammatical,
 * confident, and says nothing. "Leverage your innovative solution to unlock
 * game-changing growth in today's fast-paced landscape" passes every structural
 * check ever written. It is also the exact sentence that makes a founder cancel,
 * because it proves no one — and nothing — looked at their business.
 *
 * Two tests, both cheap and deterministic, no second model call:
 *
 *   Hollow phrasing. A list of words that consistently mark writing nobody
 *   would produce about a business they actually understood. One is a slip;
 *   several in a short draft means the model wrote around the subject instead
 *   of about it.
 *
 *   Specificity. Real marketing work names things — a product, a competitor, a
 *   number, a date, a quote. A draft with no proper nouns and no digits is a
 *   draft that would fit any company in any industry, which is the definition
 *   of the thing being replaced here.
 *
 * The verdict is not a score to display. It is a rewrite instruction: when a
 * draft fails, the caller asks again and names the exact words to drop and the
 * exact thing missing. Told "be more specific" a model produces the same text
 * with adjectives swapped; told "you wrote 'leverage' and 'game-changer' and
 * named nothing — name the product and one real number" it fixes it.
 *
 * Distilled from the banned-word and Four U's gates in the Kai CMO harness,
 * reduced to what can run inline on every draft without a model call.
 */

/**
 * Phrases that mark corporate filler. Not style preferences — each one is a
 * word that replaces a specific claim with the shape of a claim.
 */
const HOLLOW = [
  "leverage",
  "utilize",
  "utilise",
  "synergy",
  "synergies",
  "innovative",
  "cutting-edge",
  "cutting edge",
  "state-of-the-art",
  "best practices",
  "deep dive",
  "dive deep",
  "circle back",
  "touch base",
  "moving forward",
  "going forward",
  "at the end of the day",
  "it's important to note",
  "its important to note",
  "in today's fast-paced",
  "in today's rapidly evolving",
  "in the ever-evolving",
  "in conclusion",
  "first and foremost",
  "game-changer",
  "game changer",
  "paradigm shift",
  "thought leadership",
  "seamless",
  "robust",
  "holistic",
  "empower",
  "transformative",
  "revolutionize",
  "revolutionise",
  "low-hanging fruit",
  "move the needle",
  "value proposition",
  "actionable insights",
  "take it to the next level",
  "unlock the power",
  "supercharge",
  "elevate your",
  "dive into",
  "let's explore",
  "delve into",
  "landscape of",
  "in the realm of",
];

/** Drafts shorter than this are notes, and judged only on hollow phrasing. */
const SUBSTANTIAL_CHARS = 400;

/**
 * How much filler a draft is allowed, as a density rather than a count.
 *
 * A flat allowance gets this wrong at both ends. Two hollow phrases in a
 * thousand-word post are two slips; the same two in a two-line note are the
 * whole note — "leverage a better approach going forward" is nothing but
 * filler, and a flat limit of two waves it through. So the allowance grows with
 * the draft: roughly one per four hundred characters, never fewer than one and
 * never more than three, because past three the model is not writing about the
 * business at any length.
 */
function hollowAllowance(length: number): number {
  return Math.min(3, Math.max(1, Math.floor(length / SUBSTANTIAL_CHARS)));
}

export interface QualityVerdict {
  /** Whether this is worth handing to the founder. */
  passed: boolean;
  /** The hollow phrases actually found, in the order they appear. */
  hollow: string[];
  /** Whether the draft names anything real — a name, a number, a quote. */
  specific: boolean;
  /**
   * What to tell the model, if anything. Written as an instruction to the
   * writer, not as a report about the writer.
   */
  rewriteNote: string | null;
}

/** Proper nouns, digits, quotes, URLs — the marks of writing about something. */
function namesSomething(text: string): boolean {
  // A number with meaning: a price, a percentage, a count, a date, a version.
  if (/\d/.test(text.replace(/\b(19|20)\d{2}\b/g, ""))) return true;
  if (/\b(19|20)\d{2}\b/.test(text)) return true;

  // A quoted phrase — a customer's own words, which is the best raw material
  // any of these agents can hand back.
  if (/["“][^"”]{8,}["”]/.test(text)) return true;

  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|io|ai|co|dev|app|net|org)\b/i.test(text)) {
    return true;
  }

  // A capitalised word that is not simply the start of a sentence: a product,
  // a company, a person. Checked mid-sentence so headings do not count.
  if (/[a-z,]\s+[A-Z][a-zA-Z]{2,}/.test(text)) return true;

  return false;
}

export function assess(text: string): QualityVerdict {
  const draft = text.trim();
  const lower = draft.toLowerCase();

  const hollow: string[] = [];
  for (const phrase of HOLLOW) {
    // Word-boundary match, so "empower" does not fire on "empowerment" being
    // part of a customer's actual quoted sentence.
    const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) hollow.push(phrase);
  }

  // Short output is judged on filler alone. A one-line "nothing moved on their
  // pricing page this week" names nothing and is exactly the right answer —
  // demanding a number there would teach the agents to invent one.
  const substantial = draft.length >= SUBSTANTIAL_CHARS;
  const specific = substantial ? namesSomething(draft) : true;

  const tooHollow = hollow.length > hollowAllowance(draft.length);
  const passed = !tooHollow && specific;

  if (passed) {
    return { passed, hollow, specific, rewriteNote: null };
  }

  const faults: string[] = [];
  if (tooHollow) {
    faults.push(
      `you used ${hollow
        .slice(0, 5)
        .map((h) => `"${h}"`)
        .join(", ")} — cut those words and say the specific thing each one is standing in for`,
    );
  }
  if (!specific) {
    faults.push(
      "nothing in it names anything real — no product, no competitor, no number, " +
        "no date, no quote. As written it would fit any company in any industry",
    );
  }

  return {
    passed,
    hollow,
    specific,
    rewriteNote:
      `That draft does not ship: ${faults.join("; and ")}. ` +
      `Write it again, same job, same length or shorter. Name the actual things.`,
  };
}
