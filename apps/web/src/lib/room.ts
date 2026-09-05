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
 * **An agent speaks only after doing work.** Never in reply to another agent.
 * Two agents that can reply to each other will, and they will keep going until
 * the founder's balance is gone — the transcript looks like collaboration and
 * is entirely machines agreeing with each other. So a post is a side effect of
 * a real run, and the only thing that can make an agent run is the schedule,
 * the founder, or the head agent deciding.
 *
 * **The founder's @mention actually runs that agent.** Typing "@Wren why hasn't
 * the audit happened" and getting a chat reply about audits would be theatre.
 * The mention runs the agent, and what it posts back is the work.
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

  if (!mention) {
    // Nobody named. The head agent is the right answerer, but it is not put
    // through the squad runner — it has no standing job and its answer is a
    // reply, not a draft to approve.
    return { answered: null, problem: null };
  }

  if (mention.agent.template_id === HEAD_AGENT.id) {
    return { answered: nameOf(mention.agent), problem: null };
  }

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

  // Only the opening of the result. The room is for noticing; the whole thing
  // is on the agent's page, one click away.
  await postFromAgent(
    admin,
    userId,
    mention.agent,
    summarise(result.content ?? ""),
    result.generationId,
  );

  return { answered: nameOf(mention.agent), problem: null };
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
