import "server-only";
import { createAdminClient } from "./supabase/admin";
import { displayName } from "./army";
import { getTemplate } from "./templates";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * "@Vera, check what Acme changed on their pricing page."
 *
 * The head agent is the one the founder talks to, and most of the time it
 * should decide for itself which squad to put on a job. But sometimes the
 * founder already knows who they want, and the alternative to naming them is a
 * paragraph explaining which agent should do it and hoping the head agent
 * routes it correctly. An @ is faster and unambiguous.
 *
 * The mention is resolved against this founder's real agents by the name they
 * actually see — the head agent may be Seamus to one founder and something else
 * to another, and matching on a template id would mean the founder has to know
 * one. An unmatched @ is left alone rather than guessed at: "@2pm" is not an
 * agent, and silently routing that to whichever name is closest would send work
 * to a squad nobody asked for.
 */

export interface Mention {
  agent: Agent;
  name: string;
  /** The message with the @name removed, which is the actual instruction. */
  instruction: string;
}

/** Every agent this founder could name, by the name shown in their dashboard. */
export async function mentionableAgents(admin: Admin, userId: string): Promise<Agent[]> {
  const { data } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .eq("paused", false);

  return (data ?? []) as Agent[];
}

/** How the founder sees this agent, which is the only name they can type. */
export function nameOf(agent: Agent): string {
  return displayName(agent.template_id, agent.name, getTemplate(agent.template_id)?.name);
}

/**
 * Find an @mention in a message and match it to one of this founder's agents.
 *
 * Longest names are matched first. Without that, "@Ada" would win over "@Ada
 * Lovelace" whenever both exist, and the founder addressing the second one gets
 * the first plus a stray surname left in the instruction.
 */
export function findMention(text: string, agents: Agent[]): Mention | null {
  const at = text.indexOf("@");
  if (at < 0) return null;

  const candidates = agents
    .map((agent) => ({ agent, name: nameOf(agent) }))
    .filter((c) => c.name.trim().length > 1)
    .sort((a, b) => b.name.length - a.name.length);

  const lower = text.toLowerCase();

  for (const { agent, name } of candidates) {
    const needle = `@${name.toLowerCase()}`;
    const index = lower.indexOf(needle);
    if (index < 0) continue;

    // The character after the name must not be a letter, or "@Ada" would match
    // inside "@Adaline" and address the wrong agent.
    const after = text[index + needle.length];
    if (after && /[a-z0-9]/i.test(after)) continue;

    const instruction = (text.slice(0, index) + text.slice(index + needle.length))
      .replace(/^[\s,:—-]+/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return { agent, name, instruction };
  }

  return null;
}

/**
 * The line the head agent adds to its own prompt when a mention is present.
 *
 * The head agent still answers — it is the founder's colleague and going silent
 * mid-conversation because an @ appeared would be strange. What changes is that
 * it now knows the work is assigned, so it confirms rather than doing the job
 * itself and reporting a result that never happened.
 */
export function mentionInstruction(mention: Mention): string {
  return (
    `\n\nThe founder has assigned this to ${mention.name} by name. The task ` +
    `has been filed for ${mention.name} and it will do the work on its next ` +
    `run. Confirm that in one short line, the way a colleague would — say what ` +
    `${mention.name} is going to do and roughly when. Do NOT do the work ` +
    `yourself, and do not report a result: nothing has happened yet.`
  );
}

/**
 * File the instruction against the named agent.
 *
 * Written into that agent's own chat thread rather than a separate queue, so
 * the founder can open the agent and see exactly what it was asked, and the
 * agent's next run reads it as the most recent thing said to it. One mechanism
 * instead of two, and it makes the delegation visible in the place the founder
 * would look for it.
 */
export async function fileMention(
  admin: Admin,
  userId: string,
  mention: Mention,
): Promise<void> {
  if (!mention.instruction) return;

  await admin.from("chat_messages").insert({
    agent_id: mention.agent.id,
    user_id: userId,
    role: "user",
    content: mention.instruction,
  });
}
