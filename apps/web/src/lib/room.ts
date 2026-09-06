import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName, HEAD_AGENT } from "./army";
import { getTemplate } from "./templates";
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
  agentId?: string,
): Promise<RoomLine[]> {
  let messageQuery = admin.from("room_messages").select("*").eq("user_id", userId);
  if (agentId) messageQuery = messageQuery.eq("agent_id", agentId);
  const [{ data: rows, error }, { data: agentRows }] = await Promise.all([
    messageQuery
      .order("created_at", { ascending: false })
      .limit(limit),
    admin.from("agents").select("id, template_id, name").eq("user_id", userId),
  ]);
  if (error) throw new Error("The room could not be loaded. Your messages have not been deleted.");

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

  const { error } = await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    template_id: agent.template_id,
    body: trimmed.slice(0, 600),
    generation_id: generationId ?? null,
  });
  if (error) throw new Error("The agent's report could not be saved.");
}

/** The founder speaking. Their own row, no agent attached. */
export async function postFromFounder(
  admin: Admin,
  userId: string,
  body: string,
  mentions: string[],
): Promise<void> {
  const { error } = await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: null,
    template_id: null,
    body: body.trim().slice(0, 1000),
    mentions,
  });
  if (error) throw new Error("Your message could not be saved. No work was started.");
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

  const recipient = mention?.agent ?? agents.find(a => a.template_id === HEAD_AGENT.id);
  if (!recipient) return { answered: null, problem: "Start your army to talk to the team." };
  const instruction = mention?.instruction || text;
  const { chatKeyFor, respondAsAgent } = await import("./chat-model");
  const { executeHeadCommand } = await import("./head-orchestrator");
  const { data: history, error: historyError } = await admin.from("chat_messages").select("role, content")
    .eq("agent_id", recipient.id).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (historyError) throw new Error("Conversation history is unavailable. Please retry.");
  const { error: saveError } = await admin.from("chat_messages").insert({
    user_id: userId, agent_id: recipient.id, role: "user", content: instruction,
  });
  if (saveError) throw new Error("The instruction could not be saved to this agent's chat.");
  const apiKey = await chatKeyFor(recipient.id);
  if (!apiKey) throw new Error("The model connection is unavailable. Check the server configuration.");
  const command = await executeHeadCommand(recipient, instruction);
  const reply = command.handled && command.reply ? command.reply : await respondAsAgent(recipient,
    [...(history ?? []).reverse(), { role: "user" as const, content: instruction }], apiKey);
  const { error: replyError } = await admin.from("chat_messages").insert({
    user_id: userId, agent_id: recipient.id, role: "assistant", content: reply,
  });
  if (replyError) throw new Error("The answer could not be saved. Please retry later.");
  await postFromAgent(admin, userId, recipient, reply);
  const { notifyFounder } = await import("./work-report");
  await notifyFounder(admin, userId, `${nameOf(recipient)}\n\n${reply}`).catch(() => false);
  return { answered: nameOf(recipient), problem: null };
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
