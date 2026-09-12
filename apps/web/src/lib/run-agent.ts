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

/** Default v2 specialists. Legacy templates still run when added manually. */
const DRAFT_TEMPLATES = new Set([
  "content-agent", "outreach-agent", "landing-agent", "repurpose-agent",
  "blog-agent", "newsletter-agent", "seo-agent", "ads-agent",
  "video-script-agent", "proposal-agent", "review-agent", "inbox-agent",
]);

const RESEARCH_TEMPLATES = new Set([
  "research-agent", "content-agent", "seo-agent", "landing-agent",
  "blog-agent", "competitor-agent", "community-agent", "newsletter-agent",
]);

const OWN_SITE_TEMPLATES = new Set(["seo-agent", "landing-agent", "analytics-agent"]);
const LEAD_TEMPLATES = new Set(["lead-agent", "outreach-agent", "crm-agent"]);

const COMPETITOR_DEPTH: Record<string, number> = {
  "research-agent": 3,
  "landing-agent": 2,
  "competitor-agent": 3,
  "ads-agent": 2,
};

export function kindFor(templateId: string): string {
  if (templateId === "competitor-agent") return "alert";
  if (DRAFT_TEMPLATES.has(templateId)) return "post";
  return "note";
}

export interface RunResult {
  ok: boolean;
  content: string | null;
  reason: string | null;
  generationId: string | null;
}

const failed = (reason: string): RunResult => ({
  ok: false,
  content: null,
  reason,
  generationId: null,
});

/**
 * Run one agent once. Cron, Run now and head-agent delegation all use this exact
 * path, so the test path and the overnight path cannot silently drift apart.
 */
export async function runAgentOnce(
  admin: Admin,
  agent: Pick<Agent, "id" | "user_id" | "template_id" | "name" | "config">,
  options: {
    instruction?: string;
    label?: string;
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

  const known = await wikiBlock(admin, agent.user_id);
  if (known) system += `\n\n${known}`;
  system += `\n${LEARN_INSTRUCTION}`;

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
          "\n\nLIVE RESEARCH pulled just now. Use these specific facts and customer words; do not turn it into a research dump:\n" +
          research.text;
      }
    } catch {
      // A research provider failing should not erase the rest of the job.
    }
  }

  if (LEAD_TEMPLATES.has(agent.template_id)) {
    try {
      const icp = config.icp || config.audience || config.customer || config.businessContext || "";

      if (connectors.apollo) {
        const leads = await searchLeads(connectors.apollo, filtersFrom(config));
        system += leads.length
          ? "\n\nREAL PEOPLE from a live Apollo search. These are the only people you may write about. Never invent an address or add a person who is not in this list:\n" + leadsBlock(leads)
          : "\n\nThe live lead search returned no matches. Say that plainly and identify the filter most worth loosening. Do not invent filler leads.";
      } else if (monidKey && icp) {
        const found = await runCapability(monidKey, "leads", { query: icp, limit: 10 });
        system += found.ok && found.rows.length
          ? `\n\nREAL PEOPLE from ${found.via}. Use only these rows; do not invent missing fields or contacts:\n` + rowsBlock(found.rows)
          : "\n\nThe live lead search returned no usable matches" +
            (found.reason ? `: ${found.reason}` : ".") +
            " Say that plainly; do not create imaginary leads.";
      }
    } catch {
      // Continue: the model can explain that no verified list is available.
    }
  }

  const brief =
    `Do this and hand me the finished result, ready for founder review. No preamble: ${job}`;

  let content: string;
  try {
    // Critical v2 change: scheduled/manual work uses the SAME pinned model route
    // as chat for this specialist. The role does not become a different model
    // just because cron called it.
    content = await chatComplete(
      apiKey,
      system,
      [{ role: "user", content: brief }],
      agent.template_id,
    );

    const verdict = assess(content);
    if (!verdict.passed && verdict.rewriteNote) {
      try {
        const second = await chatComplete(
          apiKey,
          system,
          [
            { role: "user", content: brief },
            { role: "assistant", content },
            { role: "user", content: verdict.rewriteNote },
          ],
          agent.template_id,
        );
        if (second.trim() && assess(second).passed) content = second;
      } catch {
        // Keep the last usable draft if the repair call fails.
      }
    }
  } catch (cause) {
    return failed(cause instanceof Error ? cause.message : "The model could not be reached.");
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
      // Room failure must never lose completed work.
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
