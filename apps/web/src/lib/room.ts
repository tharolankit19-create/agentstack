import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName, HEAD_AGENT } from "./army";
import { getTemplate } from "./templates";
import { runAgentOnce } from "./run-agent";
import { findMention, mentionableAgents, nameOf } from "./mention";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The room: one shared thread where the squads and the founder talk.
 *
 * Two rules keep this from becoming the thing multi-agent chat usually becomes.
 *
 * **An agent speaks only after doing work.** A post is a side effect of a real
 * run, never a conversational reply for its own sake.
 *
 * **The founder's @mention actually runs that agent.** Typing "@Wren why hasn't
 * the audit happened" and getting a chat reply about audits would be theatre.
 * The mention runs the agent, and what it posts back is the work.
 *
 * **The head agent may delegate, once, to at most two named squad members.**
 * This is the rule that changed, and the reason it was forbidden before is
 * still true: two agents that can reply to each other will, forever, and the
 * transcript looks like collaboration while being machines agreeing with each
 * other on the founder's balance. So the bound is structural rather than
 * hopeful — only the head agent's reply is ever scanned for mentions, never a
 * squad member's, so a chain is one hop deep by construction and cannot
 * recurse no matter what any model writes.
 */

export interface RoomMessage {
  id: string;
  agent_id: string | null;
  template_id: string | null;
  body: string;
  mentions: string[];
  generation_id: string | null;
  created_at: string;
}

export interface RoomLine extends RoomMessage {
  /** The name the founder sees, or null when it is the founder speaking. */
  name: string | null;
}

/** The thread, oldest last — the shape a chat reads in. */
export async function loadRoom(
  admin: Admin,
  userId: string,
  limit = 60,
): Promise<RoomLine[]> {
  const [{ data: rows }, { data: agentRows }] = await Promise.all([
    admin
      .from("room_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin.from("agents").select("id, template_id, name").eq("user_id", userId),
  ]);

  const agents = (agentRows ?? []) as Pick<Agent, "id" | "template_id" | "name">[];

  return ((rows ?? []) as RoomMessage[])
    .map((row) => {
      if (!row.template_id) return { ...row, name: null };
      const agent = agents.find((a) => a.id === row.agent_id);
      return {
        ...row,
        name: displayName(
          row.template_id,
          agent?.name ?? null,
          getTemplate(row.template_id)?.name,
        ),
      };
    })
    .reverse();
}

/**
 * An agent reporting into the room after it has done something.
 *
 * Kept short deliberately. The room is a place to notice things, not to read
 * them — the full output lives on the agent's page, and a room that reprints
 * every draft is one nobody scrolls.
 */
export async function postFromAgent(
  admin: Admin,
  userId: string,
  agent: Pick<Agent, "id" | "template_id">,
  body: string,
  generationId?: string | null,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    template_id: agent.template_id,
    body: trimmed.slice(0, 600),
    generation_id: generationId ?? null,
  });
}

/** The founder speaking. Their own row, no agent attached. */
export async function postFromFounder(
  admin: Admin,
  userId: string,
  body: string,
  mentions: string[],
): Promise<void> {
  await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: null,
    template_id: null,
    body: body.trim().slice(0, 1000),
    mentions,
  });
}

export interface RoomReply {
  /** Which agent answered, by name, or null when nobody was addressed. */
  answered: string | null;
  /** What went wrong, when it did. */
  problem: string | null;
}

/**
 * Handle what the founder just said in the room.
 *
 * An @mention of a squad member runs that agent with the founder's words as its
 * instruction, and the result is posted back under that agent's name. That is
 * the difference between a room and a mock-up: "@Wren, why hasn't the audit
 * happened" makes the audit happen.
 *
 * With no mention, the head agent answers — it is the one that coordinates, and
 * a question thrown into the room with no name on it is a question for whoever
 * is running the team.
 */
export async function handleFounderMessage(
  admin: Admin,
  userId: string,
  text: string,
): Promise<RoomReply> {
  const agents = await mentionableAgents(admin, userId);
  const mention = findMention(text, agents);

  await postFromFounder(admin, userId, text, mention ? [mention.name] : []);

  // A squad member was named: run it, and what it posts back is the work.
  if (mention && mention.agent.template_id !== HEAD_AGENT.id) {
    const instruction = mention.instruction || "Report where you are with your work.";
    const result = await runAgentOnce(admin, mention.agent, {
      instruction,
      label: "answering you in the room",
      // This function posts its own line below, with the founder's question as
      // context. Letting the runner announce as well would say it twice.
      announce: false,
    });

    if (!result.ok) {
      await postFromAgent(
        admin,
        userId,
        mention.agent,
        `I could not do that: ${result.reason ?? "something went wrong"}.`,
      );
      return { answered: nameOf(mention.agent), problem: result.reason };
    }

    await postFromAgent(
      admin,
      userId,
      mention.agent,
      summarise(result.content ?? ""),
      result.generationId,
    );

    return { answered: nameOf(mention.agent), problem: null };
  }

  // Nobody named, or the head agent named: the head agent answers.
  //
  // Both of these used to post the founder's line and return without a word,
  // which is why the room read as a place where messages went to disappear —
  // the founder typed, the interface said someone was working, and nothing ever
  // arrived. The doc comment above this function has always claimed the head
  // agent answers; now it does.
  const head = agents.find((a) => a.template_id === HEAD_AGENT.id);
  if (!head) {
    return { answered: null, problem: "There is no head agent on this account yet." };
  }

  return headAgentTurn(admin, userId, head, text, agents);
}

/**
 * The head agent's turn: answer the founder, then put people on it.
 *
 * Two steps, and the second is what makes this a team rather than a chatbot
 * with a roster. The head agent replies in its own voice, and if that reply
 * names squad members, those members actually run and post their own answers
 * underneath — so "@Rook can you get me twenty of these" typed by the head
 * agent is a job starting, not a line of dialogue.
 *
 * Bounded three ways, because an unbounded version of this is a credit leak
 * that looks like a feature:
 *
 *   - only the head agent's reply is scanned, never a squad member's, so the
 *     chain is exactly one hop deep and cannot recurse
 *   - at most two members per turn
 *   - a member already asked in this turn is not asked twice
 */
async function headAgentTurn(
  admin: Admin,
  userId: string,
  head: Agent,
  question: string,
  agents: Agent[],
): Promise<RoomReply> {
  const { respondAsAgent, chatKeyFor } = await import("./chat-model");

  const apiKey = await chatKeyFor(head.id);
  if (!apiKey) {
    return { answered: null, problem: "No model provider is configured." };
  }

  // The recent thread, so the head agent is answering a conversation rather
  // than an isolated sentence.
  const recent = await loadRoom(admin, userId, 12);
  const roster = agents
    .filter((a) => a.template_id !== HEAD_AGENT.id)
    .map((a) => `@${nameOf(a)}`)
    .join(", ");

  const turns = recent
    .filter((line) => line.body.trim())
    .map((line) => ({
      role: line.name ? ("assistant" as const) : ("user" as const),
      content: line.name ? `${line.name}: ${line.body}` : line.body,
    }));

  turns.push({
    role: "user",
    content:
      `${question}\n\n` +
      `[You are in the team room. Your squad: ${roster || "nobody yet"}. ` +
      `Answer in one or two short lines, like a colleague typing. ` +
      `If this needs someone specific, name them with an @ and say what you want ` +
      `— they will actually go and do it. Name at most two. If you can answer it ` +
      `yourself, just answer and name nobody.]`,
  });

  let reply: string;
  try {
    reply = await respondAsAgent(head, turns, apiKey);
  } catch (cause) {
    const problem = cause instanceof Error ? cause.message : "The model did not answer.";
    await postFromAgent(admin, userId, head, `I could not answer that: ${problem}`);
    return { answered: nameOf(head), problem };
  }

  await postFromAgent(admin, userId, head, summarise(reply, 500));

  // Everyone the head agent named, in the order it named them.
  const delegated: string[] = [];
  for (const agent of agents) {
    if (delegated.length >= 2) break;
    if (agent.template_id === HEAD_AGENT.id) continue;
    const name = nameOf(agent);
    if (!name) continue;
    if (!new RegExp(`@${escapeName(name)}\\b`, "i").test(reply)) continue;

    delegated.push(name);
    const result = await runAgentOnce(admin, agent, {
      instruction: `${nameOf(head)} asked you, on behalf of the founder: ${question}`,
      label: `on it — ${nameOf(head)} asked`,
      announce: false,
    });

    await postFromAgent(
      admin,
      userId,
      agent,
      result.ok
        ? summarise(result.content ?? "")
        : `I could not do that: ${result.reason ?? "something went wrong"}.`,
      result.ok ? result.generationId : null,
    );
  }

  return { answered: nameOf(head), problem: null };
}

/** A name is user-supplied, so it is escaped before it becomes a pattern. */
function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The first couple of real sentences, for the room.
 *
 * Headings and label lines make useless previews, so they are skipped rather
 * than truncated — a room line reading "**Subject**" tells nobody anything.
 */
export function summarise(content: string, max = 320): string {
  const lines = content
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 12);

  const text = lines.slice(0, 2).join(" ") || content.trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
