import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { AgentNote, NoteKind, PlaybookEntry } from "./supabase/types";

/**
 * The memory an agent starts every run with.
 *
 * An agent that begins each run from a blank template is one that re-derives
 * the same conclusions forever: it will rewrite the hook that failed last
 * Tuesday, re-check the competitor page that has not moved in two months, and
 * pitch the audience segment that never replies. That is not a model problem,
 * it is a storage problem, and this is the storage.
 *
 * Two sources, in this order and never mixed up:
 *
 *   1. **This customer's own notes.** What their agent learned running for
 *      them. Specific, private, and always ranked above anything shared.
 *   2. **The shared playbook.** Lessons enough different customers reached
 *      independently that they stopped being about any of them. Only ever
 *      generic craft — "posts asking a question in the first line get replies"
 *      — because the promotion floor in `promote_playbook()` refuses to
 *      publish anything fewer than three customers found on their own.
 *
 * The block this produces is deliberately small. Memory that grows without
 * bound eats the context window it was supposed to make better use of, so it
 * is capped at both ends: the strongest lessons only, and a hard character
 * limit after that.
 */

/** How much of the context window memory is allowed to occupy. */
const MAX_CHARS = 4_000;
const MAX_OWN = 24;
const MAX_SHARED = 10;

/** Which lessons matter most, in the order they should be read. */
const KIND_ORDER: NoteKind[] = [
  "style",
  "audience",
  "worked",
  "failed",
  "competitor",
  "fact",
];

const KIND_HEADINGS: Record<NoteKind, string> = {
  style: "How this founder wants things written",
  audience: "What is true about their audience",
  worked: "What has worked before",
  failed: "What has not worked — do not try these again",
  competitor: "What is true about their competitors",
  fact: "Other things already established",
};

export interface AgentMemory {
  own: AgentNote[];
  shared: PlaybookEntry[];
  /** The prompt block, ready to be prepended. Empty when there is nothing yet. */
  brief: string;
}

/**
 * Everything an agent knows, ready to run.
 *
 * Both queries go through the service role, because the caller is a deployed
 * agent authenticating with its own token rather than a signed-in browser
 * session. Which agent it is has already been proved by the route; this
 * function trusts the id it is given and nothing in the request body.
 */
export async function memoryFor(
  agentId: string,
  templateId: string,
): Promise<AgentMemory> {
  const admin = createAdminClient();

  const [{ data: notes }, { data: playbook }] = await Promise.all([
    admin
      .from("agent_notes")
      .select("*")
      .eq("agent_id", agentId)
      // Confirmed often first. A lesson seen thirty times outranks one seen
      // yesterday, which is the whole reason observations are counted.
      .order("observations", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(MAX_OWN),
    admin
      .from("agent_playbook")
      .select("*")
      .eq("template_id", templateId)
      // Only lessons that are actually working. A promoted lesson whose score
      // has drifted negative is advice to ignore, not advice to pass on.
      .gt("score", 0)
      .order("score", { ascending: false })
      .order("users_seen", { ascending: false })
      .limit(MAX_SHARED),
  ]);

  const own = (notes ?? []) as AgentNote[];
  const shared = (playbook ?? []) as PlaybookEntry[];

  return { own, shared, brief: buildBrief(own, shared) };
}

/**
 * The memory block, as text.
 *
 * Exported separately so it can be unit-tested and rendered in the dashboard
 * without a database round trip — a customer should be able to read exactly
 * what their agent believes, in the same words the model sees. Memory you
 * cannot inspect is memory you cannot correct.
 */
export function buildBrief(own: AgentNote[], shared: PlaybookEntry[]): string {
  const sections: string[] = [];

  for (const kind of KIND_ORDER) {
    const lines = own
      .filter((note) => note.kind === kind)
      .map((note) => {
        // The confidence is stated rather than implied. A model told "seen 30
        // times" treats a lesson differently from one told "seen twice", and
        // it should.
        const confidence =
          note.observations >= 10
            ? "consistently"
            : note.observations >= 3
              ? "repeatedly"
              : "once";
        return `- ${note.summary} (${confidence}, ${note.observations}×)`;
      });

    if (lines.length > 0) {
      sections.push(`${KIND_HEADINGS[kind]}:\n${lines.join("\n")}`);
    }
  }

  if (shared.length > 0) {
    const lines = shared.map(
      (entry) => `- ${entry.lesson} (works for ${entry.users_seen} other teams)`,
    );
    sections.push(
      `General craft, learned across everyone running this agent:\n${lines.join("\n")}`,
    );
  }

  if (sections.length === 0) return "";

  const body = sections.join("\n\n");

  return [
    "WHAT YOU ALREADY KNOW",
    "",
    "You have run this job before. Below is what you concluded last time and",
    "the times before that. Treat it as established: do not re-derive it, do",
    "not repeat what is listed as having failed, and if you find something that",
    "contradicts it, report that as a new lesson rather than quietly ignoring",
    "the old one.",
    "",
    body.length > MAX_CHARS ? `${body.slice(0, MAX_CHARS)}\n…` : body,
  ].join("\n");
}

export interface Learning {
  kind: NoteKind;
  key: string;
  summary: string;
  /** -1 it never works, +1 it always does. */
  score?: number;
}

/**
 * Write down what a run concluded.
 *
 * Goes through the `record_learning` function rather than a plain insert,
 * because that function owns the three things that make this compression
 * rather than a log: normalising the key, folding a repeat into a counter and
 * a running mean, and pruning the tail so an agent's memory has a ceiling.
 *
 * Failures are swallowed on purpose. A run that produced good work and then
 * could not file its notes is still a run that produced good work, and losing
 * the output over a bookkeeping error would be the worse trade.
 */
export async function recordLearnings(
  agentId: string,
  learnings: Learning[],
): Promise<number> {
  if (learnings.length === 0) return 0;

  const admin = createAdminClient();
  let written = 0;

  // Ten per run. An agent that reports fifty "lessons" from one run has not
  // learned fifty things, it has written a summary — and letting that through
  // would fill the memory with noise that then outranks real lessons.
  for (const learning of learnings.slice(0, 10)) {
    const { error } = await admin.rpc("record_learning", {
      p_agent_id: agentId,
      p_kind: learning.kind,
      p_key: learning.key,
      p_summary: learning.summary,
      p_score: Math.max(-1, Math.min(1, learning.score ?? 0)),
    });
    if (!error) written += 1;
  }

  return written;
}
