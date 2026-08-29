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
import { isDue, intervalMinutes } from "@/lib/cadence";
import { assess } from "@/lib/quality";
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
 * Each of a founder's squad agents does its job — the same job its template
 * describes — on the free models, grounded in live research where it helps, and
 * drops a draft into `generations` for the founder to approve. Nothing
 * publishes on its own; the head agent's briefing and the dashboard's Today
 * card surface what landed.
 *
 * How often is the template's own business, not this worker's. Every template
 * declares a rhythm — the review agent every six hours, the SEO agent on Monday
 * mornings — and that is now honoured. It used to be flattened to once per
 * calendar day for everyone, which broke the promise in both directions at
 * once: the fast agents went quiet, and the weekly ones filed a fresh audit
 * every morning about a site that had not changed. A founder facing twenty
 * near-identical drafts stops reading all of them.
 *
 * Bounded on purpose: a hard cap on how many agents run per invocation, so a
 * slow model can never turn one tick into a timeout. Whoever has waited longest
 * goes first, and the next tick picks up the rest.
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

/**
 * Templates whose subject is the founder's own site, not the market.
 *
 * These have to load the page before they say anything about it. Without this
 * the SEO agent was handed trend results and a competitor's homepage and then
 * asked for the exact title tag to write on a page it had never seen — so it
 * guessed, fluently, and the founder got advice about a page that does not
 * exist.
 */
const OWN_SITE_TEMPLATES = new Set(["seo-agent", "landing-agent", "analytics-agent"]);

/**
 * How many competitors to read for each template.
 *
 * The competitor agent's whole job is the field, and a cron run has minutes
 * where a chat reply has seconds — so it reads the field rather than one page
 * of it. Everyone else gets the default one.
 */
const COMPETITOR_DEPTH: Record<string, number> = {
  "competitor-agent": 3,
  "ads-agent": 2,
  "landing-agent": 2,
};

/**
 * How long a run that never produced anything waits before trying again.
 *
 * Claiming the turn up front is what stops two ticks filing the same draft
 * twice, but it means a run that dies early — no model key, the provider down,
 * an empty completion — has spent the agent's slot without producing anything.
 * For a weekly agent that would cost a whole week over a blip.
 *
 * So a failed run hands most of the slot back, but not all of it: the agent
 * becomes due again in half an hour rather than immediately. A genuinely broken
 * agent then retries twice an hour instead of every tick, which is frequent
 * enough to recover on its own and rare enough not to burn the run cap that the
 * healthy agents behind it are queuing for.
 */
const RETRY_AFTER_MINUTES = 30;

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

  /** Hand back a claimed turn so a failed run retries soon, not next cycle. */
  const releaseTurn = async (agentId: string, frequency: string | undefined) => {
    const backdated = new Date(
      Date.now() - (intervalMinutes(frequency) - RETRY_AFTER_MINUTES) * 60_000,
    );
    await admin
      .from("agents")
      .update({ last_run_at: backdated.toISOString() })
      .eq("id", agentId);
  };

  // Every squad agent that could run: created, not the head, not paused. Head
  // agent has its own briefing/task/research paths and is excluded here.
  // Longest-waiting first. With a cap on how many run per tick, ordering is the
  // whole fairness story: without it the same handful at the top of the table
  // would take every slot and the tail would never work at all.
  const { data: rows } = await admin
    .from("agents")
    .select("id, user_id, template_id, name, config, status, paused, last_run_at")
    .neq("template_id", HEAD_AGENT.id)
    .eq("paused", false)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(400);

  const agents = (rows ?? []) as Pick<
    Agent,
    "id" | "user_id" | "template_id" | "name" | "config" | "status" | "paused" | "last_run_at"
  >[];

  const entitledCache = new Map<string, boolean>();
  let ran = 0;
  let considered = 0;

  for (const agent of agents) {
    if (ran >= MAX_PER_RUN) break;

    const template = getTemplate(agent.template_id);
    if (!template?.scheduledTask) continue;

    // The cheapest check first, and it needs no round-trip: the agent's own
    // rhythm against when it last worked. Most agents on most ticks are simply
    // not due, and this is what keeps that answer free.
    if (!isDue(template.frequency, agent.last_run_at)) continue;

    considered += 1;

    // Only for founders who may actually operate right now.
    let entitled = entitledCache.get(agent.user_id);
    if (entitled === undefined) {
      entitled = await userEntitled(admin, agent.user_id);
      entitledCache.set(agent.user_id, entitled);
    }
    if (!entitled) continue;

    // Claim the turn before doing the work. Two overlapping ticks would
    // otherwise both find the same agent due and file the same draft twice —
    // and a duplicate is worse than a missed slot, because the founder sees it.
    const { data: claimed } = await admin
      .from("agents")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", agent.id)
      .or(
        agent.last_run_at
          ? `last_run_at.eq.${agent.last_run_at}`
          : "last_run_at.is.null",
      )
      .select("id");
    if (!claimed?.length) continue;

    const apiKey = await chatKeyFor(agent.id);
    if (!apiKey) {
      await releaseTurn(agent.id, template.frequency);
      continue;
    }

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

    if (RESEARCH_TEMPLATES.has(agent.template_id) || OWN_SITE_TEMPLATES.has(agent.template_id)) {
      try {
        // Same merged context the prompt uses, so research is aimed at this
        // founder's actual competitors rather than the whole internet.
        const research = await gatherLiveResearch(
          admin,
          agent.user_id,
          await businessConfigFor(agent as Agent),
          template.scheduledTask,
          {
            ownSite: OWN_SITE_TEMPLATES.has(agent.template_id),
            competitorDepth: COMPETITOR_DEPTH[agent.template_id] ?? 1,
          },
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

    const brief =
      `Do your job for today and hand me the finished result, ready for me to ` +
      `review and approve — nothing else, no preamble: ${template.scheduledTask}`;

    let content: string;
    try {
      content = await chatComplete(apiKey, system, [{ role: "user", content: brief }]);

      // The gate that decides whether this is worth a founder's attention.
      // A free model asked to "write today's post" with thin context will
      // reliably produce fluent, confident, completely generic text — and
      // filing that is worse than filing nothing, because it teaches the
      // founder that opening these drafts is a waste of time.
      //
      // One retry, and it names the exact failure. "Be more specific" gets the
      // same paragraph with different adjectives; "you wrote 'leverage' and
      // 'game-changer' and named nothing" gets a rewrite. If the second attempt
      // is no better the first is kept anyway — a mediocre draft the founder
      // can edit still beats a silent day.
      const verdict = assess(content);
      if (!verdict.passed && verdict.rewriteNote) {
        try {
          const second = await chatComplete(apiKey, system, [
            { role: "user", content: brief },
            { role: "assistant", content },
            { role: "user", content: verdict.rewriteNote },
          ]);
          if (second.trim() && assess(second).passed) content = second;
        } catch {
          // Keep the first draft rather than losing the run to a retry.
        }
      }
    } catch {
      await releaseTurn(agent.id, template.frequency);
      continue;
    }

    if (!content.trim()) {
      await releaseTurn(agent.id, template.frequency);
      continue;
    }

    // Split the deliverable from the lessons. The founder reads the first; the
    // team keeps the second.
    const { content: deliverable, learned } = parseLearned(content);
    if (!deliverable.trim()) {
      await releaseTurn(agent.id, template.frequency);
      continue;
    }

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

    ran += 1;
  }

  return NextResponse.json({ ran, considered });
}
