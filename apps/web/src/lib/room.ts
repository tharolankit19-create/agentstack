import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName, HEAD_AGENT } from "./army";
import { getTemplate } from "./templates";
import { runAgentOnce } from "./run-agent";
import { findMention, mentionableAgents, nameOf } from "./mention";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

export interface RoomMessage {
  id: string;
  agent_id: string | null;
  template_id: string | null;
  body: string;
  mentions: string[];
  generation_id: string | null;
  created_at: string;
}
export interface RoomLine extends RoomMessage { name: string | null; }

export async function loadRoom(admin: Admin, userId: string, limit = 60): Promise<RoomLine[]> {
  const [{ data: rows, error: roomError }, { data: agentRows, error: agentError }] = await Promise.all([
    admin.from("room_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    admin.from("agents").select("id, template_id, name").eq("user_id", userId),
  ]);
  if (roomError) throw new Error(`room_messages query failed: ${roomError.message}`);
  if (agentError) throw new Error(`agents query failed: ${agentError.message}`);
  const agents = (agentRows ?? []) as Pick<Agent, "id" | "template_id" | "name">[];
  return ((rows ?? []) as RoomMessage[]).map((row) => {
    if (!row.template_id) return { ...row, name: null };
    const agent = agents.find((a) => a.id === row.agent_id);
    return { ...row, name: displayName(row.template_id, agent?.name ?? null, getTemplate(row.template_id)?.name) };
  }).reverse();
}

/**
 * Specialists report into Seamus in the shared room. This is real team
 * communication, but deliberately not an unbounded bot-to-bot reply loop.
 * Seamus reads recent team generations whenever the founder talks to it and on
 * briefing runs. A specialist report therefore becomes shared team context;
 * only the founder, a schedule, or Seamus' bounded delegation starts new work.
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
  const { data: head } = await admin.from("agents").select("id, template_id, name").eq("user_id", userId).eq("template_id", HEAD_AGENT.id).maybeSingle<Agent>();
  const headName = head ? nameOf(head) : HEAD_AGENT.defaultName;
  const isHead = agent.template_id === HEAD_AGENT.id;
  const { error } = await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    template_id: agent.template_id,
    body: isHead ? trimmed.slice(0, 600) : `@${headName} ${trimmed}`.slice(0, 600),
    mentions: isHead ? [] : [headName],
    generation_id: generationId ?? null,
  });
  if (error) throw new Error(`Could not post agent update: ${error.message}`);
}

export async function postFromFounder(admin: Admin, userId: string, body: string, mentions: string[]): Promise<void> {
  const { error } = await admin.from("room_messages").insert({ user_id: userId, agent_id: null, template_id: null, body: body.trim().slice(0, 1000), mentions });
  if (error) throw new Error(`Could not post founder message: ${error.message}`);
}

export interface RoomReply { answered: string | null; problem: string | null; }

export async function handleFounderMessage(admin: Admin, userId: string, text: string): Promise<RoomReply> {
  const agents = await mentionableAgents(admin, userId);
  const mention = findMention(text, agents);
  await postFromFounder(admin, userId, text, mention ? [mention.name] : []);

  // No explicit name means Seamus owns coordination. The room POST should stay
  // fast; Seamus' normal chat/briefing path consumes the shared team output.
  if (!mention) return { answered: HEAD_AGENT.defaultName, problem: null };
  if (mention.agent.template_id === HEAD_AGENT.id) return { answered: nameOf(mention.agent), problem: null };

  const instruction = mention.instruction || "Report where you are with your work.";
  const result = await runAgentOnce(admin, mention.agent, { instruction, label: "answering you in the room", announce: false });
  if (!result.ok) {
    await postFromAgent(admin, userId, mention.agent, `Couldn't finish that yet: ${result.reason ?? "temporary problem"}.`);
    return { answered: nameOf(mention.agent), problem: result.reason };
  }
  await postFromAgent(admin, userId, mention.agent, summarise(result.content ?? ""), result.generationId);
  return { answered: nameOf(mention.agent), problem: null };
}

export function summarise(content: string, max = 320): string {
  const lines = content.split("\n").map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim()).filter((l) => l.length > 12);
  const text = lines.slice(0, 2).join(" ") || content.trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
