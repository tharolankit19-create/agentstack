import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { chatComplete, chatKeyFor, systemPromptFor, businessConfigFor } from "@/lib/chat-model";
import { gatherLiveResearch } from "@/lib/research";
import { markWorking } from "@/lib/agent-activity";
import { userEntitled } from "@/lib/entitlement";
import { getTemplate } from "@/lib/templates";
import { wikiBlock, writeWiki, parseLearned, LEARN_INSTRUCTION } from "@/lib/wiki";
import { HEAD_AGENT } from "@/lib/army";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The whole army actually working — not just the head agent.
 *
 * This is the promise the product kept making and only half-keeping: "your
 * squads produce marketing while you sleep." Until now only the head agent and
 * the research pulse ran on the platform; every other agent was a card that did
 * nothing unless the founder deployed it to their own Vercel. The decision was
 * to run them all on our infrastructure by default, so this is the worker that
 * does it.
 *
 * Once a day, each of a founder's squad agents does its job — the same job its
 * template describes — on the free models, grounded in live research where it
 * helps, and drops a draft into `generations` for the founder to approve.
 * Nothing publishes on its own; the head agent's briefing and the dashboard's
 * Today card surface what landed.
 *
 * Bounded on purpose: at most one output per agent per day (idempotent on
 * today's rows) and a hard cap on how many agents run per invocation, so a slow
 * model can never turn one cron tick into a timeout. The hourly schedule catches
 * whatever this tick didn't get to.
 */

/** How many agent jobs to run in a single invocation, to stay under the clock. */
const MAX_PER_RUN = 6;

/** The kinds that read as "a draft the founder should review". */
const DRAFT_TEMPLATES = new Set([
  "content-agent",
  "outreach-agent",
  "landing-agent",
  "repurpose-agent",
  "blog-agent",
  "newsletter-agent",
  "seo-agent",
  "ads-agent",
  "video-script-agent",
  "proposal-agent",
  "review-agent",
  "inbox-agent",
]);

/** Templates whose work is sharper with a look at the live market first. */
const RESEARCH_TEMPLATES = new Set([
  "content-agent",
  "blog-agent",
  "seo-agent",
  "research-agent",
  "competitor-agent",
  "community-agent",
  "newsletter-agent",
]);

function kindFor(templateId: string): string {
  if (templateId === "competitor-agent") return "alert";
  if (DRAFT_TEMPLATES.has(templateId)) return "post";
  return "note";
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Every squad agent that could run: created, not the head, not paused. Head
  // agent has its own briefing/task/research paths and is excluded here.
  const { data: rows } = await admin
    .from("agents")
    .select("id, user_id, template_id, name, config, status, paused")
    .neq("template_id", HEAD_AGENT.id)
    .eq("paused", false)
    .limit(400);

  const agents = (rows ?? []) as Pick<
    Agent,
    "id" | "user_id" | "template_id" | "name" | "config" | "status" | "paused"
  >[];

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const entitledCache = new Map<string, boolean>();
  let ran = 0;
  let considered = 0;

  for (const agent of agents) {
    if (ran >= MAX_PER_RUN) break;
    considered += 1;

    // Only for founders who may actually operate right now.
    let entitled = entitledCache.get(agent.user_id);
    if (entitled === undefined) {
      entitled = await userEntitled(admin, agent.user_id);
      entitledCache.set(agent.user_id, entitled);
    }
    if (!entitled) continue;

    const template = getTemplate(agent.template_id);
    if (!template?.scheduledTask) continue;

    // One output per agent per day. If it already produced today, skip.
    const { count } = await admin
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .gte("created_at", since.toISOString());
    if ((count ?? 0) > 0) continue;

    const apiKey = await chatKeyFor(agent.id);
    if (!apiKey) continue;

    // Light up the dashboard while it works.
    await markWorking(admin, agent.user_id, agent.template_id, "working on today's job", 120, agent.id);

    // The same identity + business context the chat uses, plus the concrete
    // job its template describes.
    let system = await systemPromptFor(agent as Agent);

    // Read the cookbook first. This is what turns a run from "write something
    // about marketing" into "continue the work this team has been doing" — and
    // it is the only way an instruction like "what changed since last time" can
    // mean anything at all.
    const known = await wikiBlock(admin, agent.user_id);
    if (known) system += `\n\n${known}`;

    system += `\n${LEARN_INSTRUCTION}`;

    if (RESEARCH_TEMPLATES.has(agent.template_id)) {
      try {
        // Same merged context the prompt uses, so research is aimed at this
        // founder's actual competitors rather than the whole internet.
        const research = await gatherLiveResearch(
          admin,
          agent.user_id,
          await businessConfigFor(agent as Agent),
          template.scheduledTask,
        );
        if (research.used) {
          system +=
            "\n\nLIVE RESEARCH you just pulled — minutes old, specific to this " +
            "founder's market. Write from THIS, name the real things in it:\n" +
            research.text;
        }
      } catch {
        // Research is a bonus; the job still runs without it.
      }
    }

    let content: string;
    try {
      content = await chatComplete(apiKey, system, [
        {
          role: "user",
          content:
            `Do your job for today and hand me the finished result, ready for me to ` +
            `review and approve — nothing else, no preamble: ${template.scheduledTask}`,
        },
      ]);
    } catch {
      continue;
    }

    if (!content.trim()) continue;

    // Split the deliverable from the lessons. The founder reads the first; the
    // team keeps the second.
    const { content: deliverable, learned } = parseLearned(content);
    if (!deliverable.trim()) continue;

    const remembered = await writeWiki(
      admin,
      agent.user_id,
      agent.template_id,
      learned,
    );

    await admin.from("generations").insert({
      agent_id: agent.id,
      user_id: agent.user_id,
      kind: kindFor(agent.template_id),
      content: deliverable.trim(),
      approved: false,
      meta: { auto: true, task: template.scheduledTask, remembered },
    });

    await admin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agent.id);

    ran += 1;
  }

  return NextResponse.json({ ran, considered });
}
