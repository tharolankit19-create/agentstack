import { appUrl } from "@/lib/deploy";
import { SITE } from "@/lib/site";
import { roster } from "@/lib/army";
import { COST, SIGNUP_CREDITS } from "@/lib/credits-public";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Plain-text product facts for crawlers and answer engines.
 * Keep this deliberately conservative: capabilities, public pricing mechanics,
 * safety boundaries and canonical pages only.
 */
export function GET() {
  const base = appUrl();
  const team = roster();

  const body = `# ${SITE.name}

> ${SITE.tagline} ${SITE.description}

KryxAI is a pay-as-you-go marketing command center for founders. Kryx is the
head agent. Seven built-in specialists cover market research, analytics,
content, SEO, conversion, lead research and outreach.

## How it works

1. The founder gives Kryx an outcome and basic business context.
2. Kryx routes the job to the relevant specialist.
3. When live data is needed, the system chooses a suitable data tool, checks its
   schema/cost limits, and uses a bounded lookup instead of inventing facts.
4. Finished work appears in the dashboard, Room, Mission Control or scheduled
   task history. Consequential public/outbound actions remain approval-gated.

## Pricing

There is no required monthly seat subscription for the built-in PAYG product.
A new account receives ${SIGNUP_CREDITS} starter credits once. 100 credits = $1.
Purchased credits do not expire.

Example specialist prices:
- Web/market search: ${COST.web_search} credits
- Page read: ${COST.page_read} credits
- Social scan: ${COST.social_scan} credits
- Lead search: ${COST.lead_search} credits
- SEO rank/SERP check: ${COST.rank_check} credits
- Specialist draft: ${COST.draft} credits

Empty Monid lookups are not charged as successful customer work.

## Built-in team

${team.map((member) => `- **${member.name} — ${member.role}**: ${member.does}`).join("\n")}

## Scheduling

Founders can assign a plain-language task to a specific agent and schedule the
first run as once, daily or hourly. The Scheduled Work page shows the owner,
instruction, next run, recurrence and history.

## Safety and boundaries

- Kryx does not guarantee rankings, leads, revenue, citations or other outcomes.
- Missing external data is reported as missing rather than guessed.
- Public/outbound actions are approval-gated where the product says they are.
- Expensive data routes are kept out of unattended background work by default.

## Public pages

- [Home](${base})
- [Interactive demo](${base}/demo)
- [Pricing](${base}/pricing)
- [AI marketing agents](${base}/ai-marketing-agents)
- [AI marketing team](${base}/ai-marketing-team)
- [AI CMO for startups](${base}/ai-cmo-for-startups)
- [AI SEO agent](${base}/ai-seo-agent)
- [AI content marketing agent](${base}/ai-content-marketing-agent)
- [AI competitor research agent](${base}/ai-competitor-research-agent)
- [AI lead generation agent](${base}/ai-lead-generation-agent)
- [SaaS marketing automation](${base}/saas-marketing-automation)
- [Security](${base}/security)
- [Privacy](${base}/privacy)
- [Terms](${base}/terms)

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
