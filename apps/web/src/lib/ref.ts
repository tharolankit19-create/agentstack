/**
 * The reference on every piece of work: `OTS-4b21`.
 *
 * Small, and the thing that makes the product speakable. Without it a founder
 * refers to "the third post down", which changes meaning the moment anything
 * new arrives, and cannot be said to the head agent at all. With it they can
 * type "kill OTS-4b21" into the room and be understood.
 *
 * Derived, never stored: the agent's name gives the prefix and the row's own
 * id gives the suffix, so the same artifact carries the same reference on
 * every screen and after every deploy, with no column to migrate and nothing
 * to keep in sync.
 *
 * The suffix is the last four characters of a uuid — sixteen bits, so two of a
 * founder's own artifacts collide about once in a few hundred. That is the
 * right trade: this is a handle for a human in a conversation, not a key, and
 * a twelve-character reference nobody can read out loud would fail at the one
 * job it has.
 */

/** Two or three letters from the name. "Otis" → OTS, "Head Agent" → HA. */
export function prefixFor(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "AGT";

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  // One word: first letter plus the next two consonants, so Otis and Orla do
  // not both become OT.
  const letters = words[0].replace(/[^a-z]/gi, "");
  if (!letters) return "AGT";
  const rest = letters.slice(1).replace(/[aeiou]/gi, "");
  return (letters[0] + (rest || letters.slice(1))).slice(0, 3).toUpperCase();
}

export function refFor(name: string | null | undefined, id: string | null | undefined): string {
  const suffix = (id ?? "").replace(/-/g, "").slice(-4).toUpperCase();
  return suffix ? `${prefixFor(name)}-${suffix}` : prefixFor(name);
}

/** The initials for the ledger's left rail. Two characters, always. */
export function initialsFor(name: string | null | undefined): string {
  return prefixFor(name).slice(0, 2);
}
