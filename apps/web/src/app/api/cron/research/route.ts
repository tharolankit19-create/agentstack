import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { sendMessage } from "@/lib/telegram";
import { chatComplete, chatKeyFor } from "@/lib/chat-model";
import { personaFor, STYLE_CONTRACT } from "@/lib/personas";
import { scrape, search } from "@/lib/firecrawl";
import { searchX } from "@/lib/xquik";
import { loadConnectors } from "@/lib/connectors";
import { markWorking } from "@/lib/agent-activity";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The research pulse.
 *
 * Every few hours this looks at the world on the founder's behalf: it reads
 * their competitors' live pages, searches for fresh news in their space, and
 * asks the research agent one question — is any of this urgent enough to
 * interrupt the founder right now? If yes, it pings them on Telegram
 * immediately. If no, it stays silent. That silence is the feature: a research
 * agent that messages you every three hours with "nothing much" is one you
 * mute in a day.
 *
 * It runs from the platform, on the platform's free models and the founder's
 * Firecrawl key, for the same reason the briefing does — one reliable schedule
 * instead of fourteen deployed crons that each have to be right.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: links } = await admin
    .from("telegram_links")
    .select("user_id, chat_id")
    .not("chat_id", "is", null)
    .limit(200);

  const rows = (links ?? []) as { user_id: string; chat_id: string }[];
  let alerted = 0;
  let scanned = 0;

  for (const link of rows) {
    // Everything this founder's agents know about their market.
    const { data: agents } = await admin
      .from("agents")
      .select("id, template_id, config, status, paused")
      .eq("user_id", link.user_id);

    const owned = (agents ?? []) as Pick<
      Agent,
      "id" | "template_id" | "config" | "status" | "paused"
    >[];

    // Connecting Firecrawl is the switch that turns research on. The founder
    // said it plainly: they add the key, and it just runs — no separate
    // "deploy the research agent" step. So the work fires whenever there is a
    // Firecrawl key (their own wins over the platform's), and it is carried out
    // by the research agent if they deployed one, otherwise by the head agent,
    // which every founder has.
    const connectors = await loadConnectors(admin, link.user_id);
    const firecrawlKey = connectors.firecrawl ?? process.env.FIRECRAWL_API_KEY?.trim();
    if (!firecrawlKey) continue;
    const xKey = connectors.x ?? process.env.XQUIK_API_KEY?.trim();

    // Prefer a live research/competitor agent; fall back to the head agent.
    const researcher =
      owned.find(
        (a) =>
          (a.template_id === "research-agent" ||
            a.template_id === "competitor-agent") &&
          a.status === "deployed" &&
          !a.paused,
      ) ?? owned.find((a) => a.template_id === "head-agent");
    if (!researcher) continue;

    const modelKey = await chatKeyFor(researcher.id);
    if (!modelKey) continue;

    const { competitors, icp, website } = gatherContext(owned);
    if (competitors.length === 0 && !icp) continue;

    scanned += 1;
    // Light up the dashboard: the research agent is out looking at the market.
    await markWorking(
      admin,
      link.user_id,
      "research-agent",
      "scanning the market for anything urgent",
      120,
      researcher.template_id === "research-agent" ? researcher.id : null,
    );

    // 1. Read the competitors' live pages.
    const pages: string[] = [];
    for (const url of competitors.slice(0, 3)) {
      const md = await scrape(url, 6000, firecrawlKey);
      if (md) pages.push(`# ${url}\n${md.slice(0, 2500)}`);
    }

    // 2. Fresh signal from the wider web.
    const query = icp
      ? `${icp} industry news, competitor moves, opportunities this week`
      : `${competitors[0] ?? website} news this week`;
    const hits = await search(query, 5, firecrawlKey);
    const news = hits
      .map((h) => `- ${h.title}: ${h.description} (${h.url})`)
      .join("\n");

    // What people are saying on X, when it's connected — often the earliest
    // signal of a competitor move or a trend.
    const xHits = xKey
      ? await searchX(icp || competitors[0] || website, 8, xKey)
      : [];
    const chatter = xHits
      .map((x) => `- @${x.author}: ${x.text.slice(0, 160)}`)
      .join("\n");

    if (pages.length === 0 && hits.length === 0 && xHits.length === 0) continue;

    // 3. Ask the research agent: is any of this urgent?
    const persona = personaFor(researcher.template_id);
    const system = [
      "You are the founder's research agent. You watch their market and only",
      "interrupt them when something genuinely matters right now — an urgent",
      "opportunity, a competitor move, a risk, a piece of news they'd want the",
      "moment it happens.",
      persona.character,
      persona.craft ?? "",
      "",
      STYLE_CONTRACT,
      "",
      "You will be given competitor pages and recent news. Decide: is there",
      "anything here urgent enough to message the founder about right now?",
      "If YES: reply with a single short Telegram message — what happened, why",
      "it matters to them, and the one thing to consider. No preamble.",
      "If NO: reply with exactly the word NONE and nothing else. When in doubt,",
      "say NONE — a quiet agent is trusted, a noisy one is muted.",
    ].join("\n");

    let verdict = "";
    try {
      verdict = await chatComplete(modelKey, system, [
        {
          role: "user",
          content: [
            website ? `The founder's site: ${website}` : "",
            icp ? `Their customer: ${icp}` : "",
            pages.length ? `Competitor pages:\n${pages.join("\n\n")}` : "",
            news ? `Recent news:\n${news}` : "",
            chatter ? `What's being said on X:\n${chatter}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ]);
    } catch {
      continue;
    }

    const trimmed = verdict.trim();
    if (!trimmed || /^none\.?$/i.test(trimmed)) continue;

    // Don't ping the same thing twice. A fingerprint of the alert is stored and
    // compared against the last day's alerts.
    const fingerprint = createHash("sha256")
      .update(trimmed.toLowerCase().replace(/\s+/g, " "))
      .digest("hex")
      .slice(0, 16);

    if (await alreadyAlerted(admin, researcher.id, fingerprint)) continue;

    const ok = await sendMessage(link.chat_id, `Heads up - ${trimmed}`);
    if (!ok) continue;

    await admin.from("generations").insert({
      agent_id: researcher.id,
      user_id: link.user_id,
      kind: "alert",
      content: trimmed,
      approved: true,
      meta: { fingerprint },
    });
    alerted += 1;
  }

  return NextResponse.json({ scanned, alerted });
}

/** Pull competitors, ICP and website out of whatever agents hold them. */
function gatherContext(agents: Pick<Agent, "config">[]): {
  competitors: string[];
  icp: string;
  website: string;
} {
  const competitors = new Set<string>();
  let icp = "";
  let website = "";

  for (const agent of agents) {
    const c = agent.config ?? {};
    for (const raw of [c.competitors, c.competitorUrls, c.watchList]) {
      if (raw) {
        for (const line of String(raw).split(/[\n,]/)) {
          const url = line.trim();
          if (url) competitors.add(url);
        }
      }
    }
    icp = icp || c.icp || c.audience || c.customer || "";
    website = website || c.websiteUrl || c.siteUrl || c.url || "";
  }

  return { competitors: [...competitors], icp, website };
}

async function alreadyAlerted(
  admin: ReturnType<typeof createAdminClient>,
  agentId: string,
  fingerprint: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("generations")
    .select("meta")
    .eq("agent_id", agentId)
    .eq("kind", "alert")
    .gte("created_at", since)
    .limit(50);

  return ((data ?? []) as { meta: { fingerprint?: string } | null }[]).some(
    (row) => row.meta?.fingerprint === fingerprint,
  );
}
