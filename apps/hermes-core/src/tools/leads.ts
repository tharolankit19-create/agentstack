import { searchLeads, type Lead } from "@/integrations/apollo";
import type { Tool } from "@/core/types";

/** In-run store so a drafting tool can reference a lead by number. */
const found = new Map<string, Lead>();

export function recallLead(ref: string): Lead | undefined {
  return found.get(ref.trim());
}

export const findLeadsTool: Tool = {
  name: "find_leads",
  description:
    "Search Apollo for people matching an ideal customer profile. Returns each " +
    "lead numbered, with title, company, size, industry and email when available.",
  parameters: {
    type: "object",
    properties: {
      titles: {
        type: "array",
        items: { type: "string" },
        description: 'Job titles, e.g. ["Head of Growth", "VP Marketing"].',
      },
      locations: { type: "array", items: { type: "string" } },
      industries: { type: "array", items: { type: "string" } },
      employeeRanges: {
        type: "array",
        items: { type: "string" },
        description: 'Apollo size buckets, e.g. ["21,50", "51,200"].',
      },
      keywords: { type: "string" },
      limit: { type: "number", description: "How many to return. Max 25." },
    },
    required: [],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const configured = Number.parseInt(ctx.config.dailyLimit ?? "25", 10);
    const limit = Math.min(
      Number(args.limit) || (Number.isFinite(configured) ? configured : 25),
      25,
    );

    const leads = await searchLeads(
      {
        titles: toStringArray(args.titles),
        locations: toStringArray(args.locations),
        industries: toStringArray(args.industries),
        employeeRanges: toStringArray(args.employeeRanges),
        keywords: args.keywords ? String(args.keywords) : undefined,
        perPage: limit,
      },
      ctx.signal,
    );

    ctx.log("leads.found", { count: leads.length });

    found.clear();
    leads.forEach((lead, i) => found.set(String(i + 1), lead));

    if (leads.length === 0) {
      return (
        "Apollo returned no matches. The filters are probably too narrow — try " +
        "fewer job titles, a wider location, or drop the employee range."
      );
    }

    for (const lead of leads) {
      ctx.emit({
        kind: "lead",
        content: `${lead.name} — ${lead.title} at ${lead.company}`,
        meta: { ...lead },
      });
    }

    return (
      `Found ${leads.length} leads. Reference one by its number when drafting.\n\n` +
      leads
        .map(
          (lead, i) =>
            `${i + 1}. ${lead.name} — ${lead.title || "unknown title"} at ${
              lead.company || "unknown company"
            }\n` +
            `   size: ${lead.employeeCount ?? "?"} | industry: ${
              lead.industry ?? "?"
            } | ${lead.location || "location unknown"}\n` +
            `   email: ${lead.email ?? "not unlocked"} | linkedin: ${
              lead.linkedinUrl ?? "none"
            }`,
        )
        .join("\n")
    );
  },
};

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.map(String).filter((v) => v.trim().length > 0);
  return out.length > 0 ? out : undefined;
}
