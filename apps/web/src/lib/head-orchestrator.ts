import "server-only";

import { HEAD_AGENT, rosterTemplateIds } from "./army";
import { detectAction } from "./chat-actions";
import { businessConfigFor } from "./chat-model";
import { runAgentOnce } from "./run-agent";
import { parseSchedule } from "./schedule";
import { createAdminClient } from "./supabase/admin";
import type { Agent } from "./supabase/types";

/** A deterministic command router for the head agent. */
const ROUTES: { templateId: string; signal: RegExp }[] = [
  { templateId: "lead-agent", signal: /\b(leads?|prospects?|contacts?|icp list)\b/i },
  { templateId: "competitor-agent", signal: /\b(competitor|competition|rival|pricing change)\b/i },
  { templateId: "seo-agent", signal: /\b(seo|aeo|rankings?|serp|meta description|title tag)\b/i },
  { templateId: "landing-agent", signal: /\b(landing page|homepage|pricing page|conversion|cta)\b/i },
  { templateId: "blog-agent", signal: /\b(blog|article|long[ -]form)\b/i },
  { templateId: "newsletter-agent", signal: /\bnewsletter\b/i },
  { templateId: "outreach-agent", signal: /\b(outreach|cold email|follow[- ]?up|email sequence)\b/i },
  { templateId: "ads-agent", signal: /\b(ad copy|ads?|campaign angle)\b/i },
  { templateId: "video-script-agent", signal: /\b(video|reel|shorts?|script)\b/i },
  { templateId: "review-agent", signal: /\b(reviews?|reputation)\b/i },
  { templateId: "analytics-agent", signal: /\b(analytics|metrics|funnel|conversion rate)\b/i },
  { templateId: "research-agent", signal: /\b(research|market|trend|investigate)\b/i },
  { templateId: "content-agent", signal: /\b(post|thread|content|linkedin|twitter|\bx\b)\b/i },
];

const WORK = /\b(write|draft|create|make|prepare|audit|analyse|analyze|research|find|check|build|rewrite|review|run|schedule)\b/i;

export interface HeadCommandResult {
  handled: boolean;
  reply?: string;
}

function routeFor(text: string): string | null {
  return ROUTES.find((route) => route.signal.test(text))?.templateId ?? null;
}

function compactResult(name: string, content: string): string {
  const clean = content.trim();
  if (clean.length <= 2_400) return `${name} finished it.\n\n${clean}`;
  return `${name} finished it. Here is the useful part:\n\n${clean.slice(0, 2_350).trimEnd()}…\n\nThe full deliverable is saved in Recent output.`;
}

/**
 * Turn a founder's instruction into real work before the model gets a chance
 * to merely talk about doing it. Returns unhandled for ordinary conversation.
 */
export async function executeHeadCommand(
  head: Agent,
  message: string,
): Promise<HeadCommandResult> {
  if (head.template_id !== HEAD_AGENT.id || !WORK.test(message)) {
    return { handled: false };
  }

  // Live lookups already have a dedicated Monid path that returns structured
  // rows. Let that path win over generic delegation.
  if (detectAction(message)) return { handled: false };

  const admin = createAdminClient();
  const routedTemplate = routeFor(message);
  const targetTemplate = routedTemplate ?? "content-agent";

  const { data: target } = await admin
    .from("agents")
    .select("*")
    .eq("user_id", head.user_id)
    .eq("template_id", targetTemplate)
    .maybeSingle<Agent>();

  if (!target) {
    return {
      handled: true,
      reply: `The ${targetTemplate.replace(/-agent$/, "").replace(/-/g, " ")} specialist is not in your army yet. Start the full army and try again.`,
    };
  }

  const config = await businessConfigFor(head);
  const schedule = parseSchedule(message, config.timezone || "UTC");
  if (schedule) {
    const { error } = await admin.from("scheduled_tasks").insert({
      user_id: head.user_id,
      agent_id: target.id,
      instruction: schedule.task || message,
      run_at: schedule.runAt.toISOString(),
      when_label: schedule.whenLabel,
    });

    return error
      ? { handled: true, reply: `I could not save that schedule: ${error.message}` }
      : {
          handled: true,
          reply: `Scheduled. ${target.name} will do it ${schedule.whenLabel}. You can see it under Scheduled.`,
        };
  }

  const result = await runAgentOnce(admin, target, {
    instruction: message,
    label: `working for ${head.name}`,
    announce: true,
  });

  if (!result.ok || !result.content) {
    return { handled: true, reply: `${target.name} could not finish it: ${result.reason ?? "the run failed"}` };
  }

  return { handled: true, reply: compactResult(target.name, result.content) };
}

/** All built-in roles the shared runtime is expected to have available. */
export function expectedArmySize(): number {
  return rosterTemplateIds().length;
}
