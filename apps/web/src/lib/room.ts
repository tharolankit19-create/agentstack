import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName, HEAD_AGENT } from "./army";
import { getTemplate } from "./templates";
import { runAgentOnce } from "./run-agent";
import { findMention, mentionableAgents, nameOf } from "./mention";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;
type DbError = { code?: string; message?: string } | null;

function roomStorageMissing(error: DbError) {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || (message.includes("room_messages") && (message.includes("does not exist") || message.includes("schema cache")));
}

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
  if (roomError && !roomStorageMissing(roomError)) throw new Error(`room_messages query failed: ${roomError.message}`);
  if (agentError) throw new Error(`agents query failed: ${agentError.message}`);
  if (roomError && roomStorageMissing(roomError)) return [];
  const agents = (agentRows ?? []) as Pick<Agent, "id" | "template_id" | "name">[];
  return ((rows ?? []) as RoomMessage[]).map((row) => {
    if (!row.template_id) return { ...row, name: null };
    const agent = agents.find((a) => a.id === row.agent_id);
    return { ...row, name: displayName(row.template_id, agent?.name ?? null, getTemplate(row.template_id)?.name) };
  }).reverse();
}

export async function postFromAgent(admin: Admin, userId: string, agent: Pick<Agent, "id" | "template_id">, body: string, generationId?: string | null): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { data: head } = await admin.from("agents").select("id, template_id, name").eq("user_id", userId).eq("template_id", HEAD_AGENT.id).maybeSingle<Agent>();
  const headName = head ? nameOf(head) : HEAD_AGENT.defaultName;
  const isHead = agent.template_id === HEAD_AGENT.id;
  const { error } = await admin.from("room_messages").insert({
    user_id: userId,
    agent_id: agent.id,
    template_id: agent.template_id,
    body: isHead ? trimmed.slice(0, 900) : `@${headName} ${trimmed}`.slice(0, 900),
    mentions: isHead ? [] : [headName],
    generation_id: generationId ?? null,
  });
  if (error && !roomStorageMissing(error)) throw new Error(`Could not post agent update: ${error.message}`);
}

export async function postFromFounder(admin: Admin, userId: string, body: string, mentions: string[]): Promise<void> {
  const { error } = await admin.from("room_messages").insert({ user_id: userId, agent_id: null, template_id: null, body: body.trim().slice(0, 1000), mentions });
  if (error && !roomStorageMissing(error)) throw new Error(`Could not post founder message: ${error.message}`);
}

export interface RoomReply { answered: string | null; problem: string | null; }

export async function handleFounderMessage(admin: Admin, userId: string, text: string): Promise<RoomReply> {
  const agents = await mentionableAgents(admin, userId);
  const mention = findMention(text, agents);
  const target = mention?.agent ?? agents.find((agent) => agent.template_id === HEAD_AGENT.id) ?? null;
  await postFromFounder(admin, userId, text, mention ? [mention.name] : []);

  if (!target) return { answered: null, problem: "Kryx is not configured yet." };

  const instruction = mention?.instruction || text.replace(/^@?kryx\b[:,\s-]*/i, "").trim() || "Give me a short useful update.";
  const result = await runAgentOnce(admin, target, {
    instruction,
    label: target.template_id === HEAD_AGENT.id ? "answering the founder in the room" : "answering you in the room",
    announce: false,
  });

  if (!result.ok) {
    await postFromAgent(admin, userId, target, `Couldn't finish that yet: ${result.reason ?? "temporary problem"}.`);
    return { answered: nameOf(target), problem: result.reason };
  }

  await postFromAgent(admin, userId, target, summarise(result.content ?? ""), result.generationId);
  return { answered: nameOf(target), problem: null };
}

export function summarise(content: string, max = 520): string {
  const lines = content.split("\n").map((line) => line.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim()).filter((line) => line.length > 8);
  const text = lines.slice(0, 4).join(" ") || content.trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
