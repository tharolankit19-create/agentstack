import "server-only";
import { createAdminClient } from "./supabase/admin";
import { chatComplete, chatKeyFor, systemPromptFor, businessConfigFor } from "./chat-model";
import { gatherLiveResearch } from "./research";
import { markWorking } from "./agent-activity";
import { getTemplate } from "./templates";
import { wikiBlock, writeWiki, parseLearned, LEARN_INSTRUCTION } from "./wiki";
import { assess } from "./quality";
import { searchLeads, filtersFrom, leadsBlock } from "./apollo";
import { runCapability, rowsBlock } from "./monid-capabilities";
import { loadConnectors, houseMonidKey, houseFirecrawlKey } from "./connectors";
import { gatherIntel, hasBrief } from "./agent-intel";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * One agent, doing its job, once.
 *
 * This used to live inside the cron loop, which meant it could only ever happen
 * on a schedule. There was no way to press a button and watch an agent work —
 * the "Run now" that existed called a *deployed* agent over HTTP, from the era
 * when each customer hosted their own, and on the platform-hosted model it
 * called nothing at all.
 *
 * Pulled out here, the same code serves three callers: the cron, the founder
 * pressing Run, and the head agent delegating a job to a named squad member.
 * That matters beyond tidiness — a manual run that took a different path would
 * drift from the scheduled one, and the founder would be testing something
 * other than what runs overnight.
 */

/** The kinds whose output reads as "a draft the founder should review". */
const DRAFT_TEMPLATES = new Set([
  "content-agent", "outreach-agent", "landing-agent", "repurpose-agent",
  "blog-agent", "newsletter-agent", "seo-agent", "ads-agent",
  "video-script-agent", "proposal-agent", "review-agent", "inbox-agent",
]);

/** Templates whose work is sharper with a look at the live market first. */
const RESEARCH_TEMPLATES = new Set([
  "content-agent", "blog-agent", "seo-agent", "research-agent",
  "competitor-agent", "community-agent", "newsletter-agent",
]);

/** Templates whose subject is the founder's own site, not the market. */
const OWN_SITE_TEMPLATES = new Set(["seo-agent", "landing-agent", "analytics-agent"]);

/** Templates that must hand back real people rather than prose about people. */
const LEAD_TEMPLATES = new Set(["lead-agent", "outreach-agent", "crm-agent"]);

/** How many competitors to read, per template. */
const COMPETITOR_DEPTH: Record<string, number> = {
  "competitor-agent": 3,
  "ads-agent": 2,
  "landing-agent": 2,
};

export function kindFor(templateId: string): string {
  if (templateId === "competitor-agent") return "alert";
  if (DRAFT_TEMPLATES.has(templateId)) return "post";
  return "note";
}

export interface RunResult {
  ok: boolean;
  /** What the agent produced, when it produced something. */
  content: string | null;
  /** One line for the founder when it did not. */
  reason: string | null;
  /** The generation row, so a caller can link straight to it. */
  generationId: string | null;
}

const failed = (reason: string): RunResult => ({
  ok: false,
  content: null,
  reason,
  generationId: null,
});

/**
 * Run one agent now.
 *
 * `instruction` overrides the template's standing job, which is what makes
 * "@Wren, audit the pricing page" different from "@Wren, do your weekly audit".
 * Without it the agent does the job its template describes.
 *
 * Never throws. Callers are a cron that must survive one bad agent and a button
 * that must say something useful rather than showing a stack trace.
 */
export async function runAgentOnce(
  admin: Admin,
  agent: Pick<Agent, "id" | "user_id" | "template_id" | "name" | "config">,
  options: {
    instruction?: string;
    label?: string;
    /**
     * Whether to post the result into the room. Off for a run the room itself
     * triggered, which posts its own line and would otherwise double up.
     */
    announce?: boolean;
  } = {},
): Promise<RunResult> {
  const template = getTemplate(agent.template_id);
  const job = options.instruction?.trim() || template?.scheduledTask;
  if (!job) return failed("This agent has no standing job to run.");

  const apiKey = await chatKeyFor(agent.id);
  if (!apiKey) return failed("No model key is configured, so no agent can think.");

  await markWorking(
    admin,
    agent.user_id,
    agent.template_id,
    options.label ?? "working on it",
    180,
    agent.id,
  );

  const connectors = await loadConnectors(admin, agent.user_id);
  const monidKey = connectors.monid ?? (await houseMonidKey(admin));
  const config = await businessConfigFor(agent as Agent);

  let system = await systemPromptFor(agent as Agent);

  // The cookbook. This is what turns a run from "write something about
  // marketing" into "continue the work this team has been doing".
  const known = await wikiBlock(admin, agent.user_id);
  if (known) system += `\n\n${known}`;
  system += `\n${LEARN_INSTRUCTION}`;

  // Whatever this agent's job needs looked up, through the one key.
  if (monidKey && hasBrief(agent.template_id)) {
    const intel = await gatherIntel(monidKey, agent.template_id, config);
    if (intel.text) system += intel.text;
  }

  if (RESEARCH_TEMPLATES.has(agent.template_id) || OWN_SITE_TEMPLATES.has(agent.template_id)) {
    try {
      const research = await gatherLiveResearch(admin, agent.user_id, config, job, {
        ownSite: OWN_SITE_TEMPLATES.has(agent.template_id),
        competitorDepth: COMPETITOR_DEPTH[agent.template_id] ?? 1,
      });
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

  // Real people before the model writes about them. The founder's own Apollo
  // seat is already paid for, so it wins; Monid is the path for the founder who
  // connected nothing, which is most of them.
  if (LEAD_TEMPLATES.has(agent.template_id)) {
    try {
      const icp = config.icp || config.audience || config.customer || config.businessContext || "";

      if (connectors.apollo) {
        const leads = await searchLeads(connectors.apollo, filtersFrom(config));
        system += leads.length
          ? "\n\nREAL PEOPLE you just found, from a live Apollo search. These are " +
            "the only people you may write about. Never add anyone who is not on " +
            "this list, never invent an email address, and where the address is " +
            "locked say so rather than guessing it:\n" + leadsBlock(leads)
          : "\n\nYour lead search came back empty this run. Say that plainly, name " +
            "which filter was probably too narrow, and do not fill the report with " +
            "people you did not find.";
      } else if (monidKey && icp) {
        const found = await runCapability(monidKey, "leads", { query: icp, limit: 10 });
        system += found.ok && found.rows.length
          ? `\n\nREAL PEOPLE you just found, via ${found.via}. These are the only ` +
            "people you may write about. Never add anyone who is not on this list, " +
            "and never invent an email address — where a row has no address, say so " +
            "rather than guessing one. Field names come from the source and vary; " +
            "read what is there:\n" + rowsBlock(found.rows)
          : "\n\nYour lead search produced nothing this run" +
            (found.reason ? `: ${found.reason}` : ".") +
            " Report that plainly and do not fill the report with people you did not find.";
      }
    } catch {
      // A lead search that fails must not cost the run.
    }
  }

  const brief =
    `Do this and hand me the finished result, ready for me to review and ` +
    `approve — nothing else, no preamble: ${job}`;

  let content: string;
  try {
    content = await chatComplete(apiKey, system, [{ role: "user", content: brief }]);

    // The gate. A free model asked to "write today's post" with thin context
    // reliably produces fluent, confident, generic text, and filing that is
    // worse than filing nothing — it teaches the founder that opening these is
    // a waste of time. One retry, naming the exact failure.
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
  } catch (cause) {
    return failed(
      cause instanceof Error ? cause.message : "The model could not be reached.",
    );
  }

  if (!content.trim()) return failed("The agent came back with nothing.");

  const { content: deliverable, learned } = parseLearned(content);
  if (!deliverable.trim()) return failed("The agent came back with nothing usable.");

  const remembered = await writeWiki(admin, agent.user_id, agent.template_id, learned);

  const { data: row } = await admin
    .from("generations")
    .insert({
      agent_id: agent.id,
      user_id: agent.user_id,
      kind: kindFor(agent.template_id),
      content: deliverable.trim(),
      approved: false,
      meta: { task: job, remembered, manual: Boolean(options.instruction) },
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  await admin
    .from("agents")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", agent.id);

  // Say so in the room, unless the caller is already going to. An agent that
  // works and never mentions it is why the squads felt like separate tools
  // rather than a team — and the room being empty is what makes it look like a
  // mock-up rather than a feature.
  if (options.announce !== false) {
    try {
      const { postFromAgent, summarise } = await import("./room");
      await postFromAgent(
        admin,
        agent.user_id,
        agent,
        summarise(deliverable),
        row?.id ?? null,
      );
    } catch {
      // The room is a nicety. A missing table or a failed insert must never
      // cost the work the agent just did.
    }
  }

  return {
    ok: true,
    content: deliverable.trim(),
    reason: null,
    generationId: row?.id ?? null,
  };
}

export { RESEARCH_TEMPLATES, OWN_SITE_TEMPLATES, LEAD_TEMPLATES, COMPETITOR_DEPTH, DRAFT_TEMPLATES };
export { houseFirecrawlKey };
