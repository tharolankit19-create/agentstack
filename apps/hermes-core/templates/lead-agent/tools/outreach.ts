import { generateText } from "@/integrations/openai";
import { loadTemplate } from "@/templates/loader";
import { render } from "@/core/agent";
import { recallLead } from "./prospector";
import type { Tool } from "@/core/types";

/**
 * Writes the opening email for one lead.
 *
 * Drafting only. This agent never sends mail: deliverability, suppression
 * lists and unsubscribes belong to the founder's sending tool, and an agent
 * that can send is an agent that can burn a domain overnight.
 */
export const outreachTool: Tool = {
  name: "write_email",
  description:
    "Write a personalised opening email for one lead found by find_leads. " +
    "Reference the lead by its number. Returns subject and body — nothing is sent.",
  parameters: {
    type: "object",
    properties: {
      leadNumber: {
        type: "string",
        description: "The lead's number from the find_leads results, e.g. \"3\".",
      },
      angle: {
        type: "string",
        description: "Optional angle to lead with, e.g. 'they are hiring SDRs'.",
      },
    },
    required: ["leadNumber"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const ref = String(args.leadNumber ?? "").trim();
    const lead = recallLead(ref);
    if (!lead) {
      throw new Error(
        `No lead numbered "${ref}" in this run. Call find_leads first, then use ` +
          `the numbers it returned.`,
      );
    }

    const template = await loadTemplate();
    const prompt = render(template.prompts.email ?? "", {
      ...ctx.config,
      name: lead.name,
      title: lead.title || "unknown",
      company: lead.company || "unknown",
      industry: lead.industry ?? "unknown",
      employeeCount: lead.employeeCount ? String(lead.employeeCount) : "unknown",
      location: lead.location || "unknown",
      senderName: ctx.config.senderName ?? "",
      offer: ctx.config.offer ?? "",
      tone: ctx.config.tone ?? "Direct",
    });

    const email = await generateText({
      model: process.env.AGENT_MODEL || template.config.model,
      temperature: 0.6,
      system:
        "You write short cold emails that get replies. You never invent facts " +
        "about the recipient and never claim familiarity you do not have.",
      user: args.angle ? `${prompt}\n\nLead with this angle: ${args.angle}` : prompt,
      signal: ctx.signal,
    });

    ctx.emit({
      kind: "lead",
      content: email,
      meta: {
        draft: true,
        name: lead.name,
        title: lead.title,
        company: lead.company,
        email: lead.email,
        linkedinUrl: lead.linkedinUrl,
      },
    });
    ctx.log("email.drafted", { company: lead.company });

    const to = lead.email ?? `${lead.linkedinUrl ?? "no email or LinkedIn on file"}`;
    return `To: ${lead.name} (${to})\n\n${email}`;
  },
};
