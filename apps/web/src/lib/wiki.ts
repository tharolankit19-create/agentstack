import "server-only";
import { createAdminClient } from "./supabase/admin";

/**
 * The team wiki — shared memory that outlives every agent.
 *
 * Rob's org chart calls this the cookbook, and it is the piece this product was
 * missing. Without it every scheduled run starts from zero: the competitor
 * agent is asked what changed "since last time" with no record of a last time,
 * the research agent is asked for "anything new" with no idea what is old, and
 * the writer reinvents the founder's positioning every morning. That is what
 * generic output actually is — not a weak model, an amnesiac team.
 *
 * So every agent reads this before it works and writes back what it learned.
 * The founder owns it and can correct anything in it, because shared truth that
 * nobody can fix is just a shared mistake.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type WikiKind =
  | "fact"
  | "decision"
  | "worked"
  | "failed"
  | "competitor"
  | "audience"
  | "style";

export interface WikiEntry {
  id: string;
  kind: WikiKind;
  key: string;
  title: string;
  body: string;
  source_template: string | null;
  times_seen: number;
  pinned: boolean;
  updated_at: string;
}

/** What the team currently knows, freshest and pinned first. */
export async function readWiki(
  admin: Admin,
  userId: string,
  limit = 25,
): Promise<WikiEntry[]> {
  const { data } = await admin
    .from("team_wiki")
    .select("id, kind, key, title, body, source_template, times_seen, pinned, updated_at")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as WikiEntry[];
}

/**
 * The wiki as a block an agent can read in its prompt.
 *
 * Deliberately compact — this rides in front of every run, and a cookbook that
 * eats the context window starves the actual work.
 */
export async function wikiBlock(
  admin: Admin,
  userId: string,
  limit = 18,
): Promise<string> {
  const entries = await readWiki(admin, userId, limit);
  if (entries.length === 0) return "";

  const lines = entries.map(
    (e) => `- [${e.kind}] ${e.title}: ${e.body.slice(0, 220)}`,
  );

  return [
    "WHAT YOUR TEAM ALREADY KNOWS about this founder's business — accumulated by",
    "you and the other agents over previous runs. Treat it as established: build",
    "on it, do not rediscover it, and do not contradict it without saying why.",
    ...lines,
  ].join("\n");
}

/** One thing an agent learned, on its way into the cookbook. */
export interface WikiWrite {
  kind: WikiKind;
  key: string;
  title: string;
  body: string;
}

/**
 * Record what an agent learned.
 *
 * Upserted on (user, key) so the same lesson seen twice becomes one entry with
 * a higher count rather than two rows saying the same thing. Never throws: a
 * failed write must not lose the work the agent just did.
 */
export async function writeWiki(
  admin: Admin,
  userId: string,
  sourceTemplate: string,
  entries: WikiWrite[],
): Promise<number> {
  let written = 0;

  for (const entry of entries.slice(0, 5)) {
    const key = slug(entry.key);
    if (!key || !entry.title.trim() || !entry.body.trim()) continue;

    try {
      const { data: existing } = await admin
        .from("team_wiki")
        .select("id, times_seen")
        .eq("user_id", userId)
        .eq("key", key)
        .maybeSingle<{ id: string; times_seen: number }>();

      if (existing) {
        await admin
          .from("team_wiki")
          .update({
            title: entry.title.trim().slice(0, 200),
            body: entry.body.trim().slice(0, 4000),
            times_seen: existing.times_seen + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin.from("team_wiki").insert({
          user_id: userId,
          kind: entry.kind,
          key,
          title: entry.title.trim().slice(0, 200),
          body: entry.body.trim().slice(0, 4000),
          source_template: sourceTemplate,
        });
      }
      written += 1;
    } catch {
      // Losing a lesson is survivable; losing the run is not.
    }
  }

  return written;
}

function slug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Pull the LEARNED block out of an agent's reply.
 *
 * Agents are asked to end their work with a short machine-readable tail rather
 * than a second model call — one round trip, and the founder never sees it
 * because it is stripped from the stored content.
 *
 * Format, one per line:
 *   LEARNED: kind | key | title | body
 */
export function parseLearned(reply: string): {
  content: string;
  learned: WikiWrite[];
} {
  const learned: WikiWrite[] = [];
  const kept: string[] = [];

  const KINDS = new Set<WikiKind>([
    "fact", "decision", "worked", "failed", "competitor", "audience", "style",
  ]);

  for (const line of reply.split("\n")) {
    const match = /^\s*LEARNED\s*:\s*(.+)$/i.exec(line);
    if (!match) {
      kept.push(line);
      continue;
    }

    const parts = match[1].split("|").map((p) => p.trim());
    if (parts.length < 4) continue;

    const kind = parts[0].toLowerCase() as WikiKind;
    learned.push({
      kind: KINDS.has(kind) ? kind : "fact",
      key: parts[1],
      title: parts[2],
      body: parts.slice(3).join(" | "),
    });
  }

  return { content: kept.join("\n").trim(), learned };
}

/** The instruction that asks an agent to contribute to the cookbook. */
export const LEARN_INSTRUCTION = [
  "",
  "After your work, on its own final lines, record anything worth the team",
  "remembering — a fact about the business, a competitor's current price, an",
  "angle that worked or flopped. Use exactly this format, one per line, at most",
  "three, and nothing after them:",
  "LEARNED: kind | short-stable-key | short title | one sentence",
  "kind is one of: fact, decision, worked, failed, competitor, audience, style.",
  "Reuse the same key when updating something you already recorded. If there is",
  "genuinely nothing new, write no LEARNED lines at all.",
].join("\n");
