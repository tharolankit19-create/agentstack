import { appUrl } from "@/lib/deploy";
import { SITE } from "@/lib/site";
import { PLAN_LIST } from "@/lib/plans";
import { TEMPLATES, CATEGORIES } from "@/lib/templates";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * /llms.txt — the site, in the form an answer engine can actually use.
 *
 * A marketing site is built for a human scrolling it: the argument is spread
 * across scroll-revealed sections, the pricing is a comparison table, and the
 * agent list is a grid of cards. An assistant asked "what replaces Ahrefs for a
 * solo founder" has to reconstruct all of that from markup. This is the same
 * facts written once, plainly, in the order a question gets answered.
 *
 * Two rules keep it honest, and both matter more here than anywhere else on the
 * site, because this is the file whose whole purpose is to be quoted:
 *
 *   Every number is generated from the same source the product runs on — the
 *   plan definitions and the template catalog — so it cannot drift from what a
 *   customer is actually sold. A stale price in the file the assistants read is
 *   worse than no file.
 *
 *   Nothing here claims a ranking, a citation, or a result. The convention is a
 *   courtesy to cooperative agents and nothing more: publishing it does not put
 *   the site in an AI answer, and Google has said plainly it is not a
 *   requirement for their generative surfaces. It is offered because the site
 *   would rather be read correctly than guessed at.
 */
export function GET() {
  const base = appUrl();
  const savings = TEMPLATES.reduce((sum, t) => sum + (t.replaces?.monthlyUsd ?? 0), 0);

  const byCategory = CATEGORIES.map((category) => {
    const agents = TEMPLATES.filter((t) => t.category === category);
    if (!agents.length) return null;
    return [
      `### ${category}`,
      ...agents.map((agent) => {
        const replaces = agent.replaces?.tools?.length
          ? ` Replaces ${agent.replaces.tools.join(", ")}.`
          : "";
        return `- **${agent.name}** — ${agent.description}${replaces}`;
      }),
    ].join("\n");
  }).filter(Boolean);

  const plans = PLAN_LIST.map((plan) =>
    [
      `### ${plan.name} — $${plan.priceUsd}/month`,
      plan.tagline,
      "",
      ...plan.features.map((f) => `- ${f}`),
    ].join("\n"),
  );

  const body = `# ${SITE.name}

> ${SITE.tagline} ${SITE.description}

${SITE.name} is a marketing team made of AI agents. A founder answers four
questions at signup, and a head agent plus a set of squad agents are created for
them. The squads run on their own schedules — research, SEO, competitor intel,
content, cold outreach, reputation — and file their work as drafts. The head
agent reads what the squads produced and messages the founder a briefing on
Telegram every morning. The founder replies to approve.

## What it is for

Founders and small teams who are paying for marketing SaaS they barely use. Each
agent is mapped to the product it replaces, so the comparison is concrete rather
than rhetorical. Replacing the full set is roughly $${savings.toLocaleString("en-US")}/month of software.

## How it works

1. Answer four questions about the business, its customer, and its competitors.
2. The head agent and the squads are created and start on their own schedules.
   Nothing is deployed by hand and no terminal is involved.
3. Each agent works to the cadence its job needs — reputation checks every few
   hours, competitor intel daily, SEO audits weekly.
4. Work arrives as drafts. Nothing posts, sends, or spends without approval.

## Boundaries — what it does not do

- Nothing publishes, emails, or spends money on its own. Every output is a draft
  the founder approves.
- Agents report what they can actually see. They do not have ranking data,
  traffic, or backlink numbers unless a tool is connected, and they say so
  rather than estimating.
- No guarantee is made about search rankings or citations in AI answers,
  because none can be.

## The agents

${byCategory.join("\n\n")}

## Pricing

${plans.join("\n\n")}

All plans include the model cost on shared free models; connecting your own
provider key runs at that provider's price. Cancel in one click and keep
everything the agents made.

## Pages

- [Home](${base}) — what it is, and the argument for it
- [Pricing](${base}/pricing) — the three plans in full
- [What it replaces](${base}/replace) — per-tool comparisons
- [Terms](${base}/terms)
- [Privacy](${base}/privacy)

## About

Built by ${SITE.founder}${SITE.twitterHandle ? ` (@${SITE.twitterHandle.replace(/^@/, "")})` : ""}.
${SITE.supportEmail ? `Support: ${SITE.supportEmail}` : ""}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
