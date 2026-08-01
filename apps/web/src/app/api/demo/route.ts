import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The free demo on the landing page.
 *
 * This is the real Content Agent prompt, running on the visitor's real site,
 * paid for with the platform's own OpenAI key. Giving the best feature away
 * before the paywall is the point: people who read good drafts about their own
 * product do not need the rest of the page explained to them.
 *
 * It is capped hard — 3 runs per IP per hour, one page, the cheap model — so
 * the giveaway stays a marketing cost and not a bill.
 */

const bodySchema = z.object({ url: z.string().min(4).max(300) });

const DEMO_LIMIT = 3;
const DEMO_WINDOW_SECONDS = 3600;

export async function POST(request: Request) {
  const platformKey = process.env.DEMO_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!platformKey) {
    return NextResponse.json(
      { error: "The demo is offline right now. The agents themselves still work." },
      { status: 503 },
    );
  }

  const limit = rateLimit(`demo:${clientIp(request)}`, DEMO_LIMIT, DEMO_WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `That is ${DEMO_LIMIT} free runs this hour. Buy the agent and it runs every weekday instead.`,
      },
      { status: 429, headers: { "retry-after": String(limit.resetInSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Send a website URL." }, { status: 400 });
  }

  let target: URL;
  try {
    target = safeUrl(parsed.data.url);
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "That is not a valid URL." },
      { status: 400 },
    );
  }

  let page: { title: string; brief: string };
  try {
    page = await readPage(target);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? `Could not read that page: ${cause.message}`
            : "Could not read that page.",
      },
      { status: 422 },
    );
  }

  try {
    const drafts = await write(platformKey, page.brief);
    return NextResponse.json({
      site: { title: page.title, url: target.toString() },
      tweets: drafts.tweets,
      linkedin: drafts.linkedin,
    });
  } catch (cause) {
    console.error("[demo] generation failed:", cause);
    return NextResponse.json(
      { error: "The writer is busy. Try again in a moment." },
      { status: 502 },
    );
  }
}

function safeUrl(input: string): URL {
  const withScheme = /^https?:\/\//i.test(input.trim())
    ? input.trim()
    : `https://${input.trim()}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("That is not a valid URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https URLs work here.");
  }

  // This route fetches a URL a stranger supplied, from inside our own network.
  // Private ranges are refused so the demo cannot be used to probe internals.
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[?::1\]?$/.test(host);

  if (isPrivate) throw new Error("That address is not reachable from here.");
  return parsed;
}

async function readPage(target: URL): Promise<{ title: string; brief: string }> {
  const response = await fetch(target, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AgentStackBot/1.0; +https://agentstack.dev/bot)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`the site returned HTTP ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").includes("html")) {
    throw new Error("that URL is not an HTML page");
  }

  const html = (await response.text()).slice(0, 1_500_000);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (text.length < 120) {
    throw new Error(
      "that page is mostly JavaScript. Try a docs, blog, or pricing page",
    );
  }

  return {
    title,
    brief: [
      `URL: ${target}`,
      title && `Title: ${title}`,
      description && `Description: ${description}`,
      headings.length && `Headings:\n- ${headings.slice(0, 15).join("\n- ")}`,
      `Content:\n${text.slice(0, 4_000)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

async function write(
  apiKey: string,
  brief: string,
): Promise<{ tweets: string[]; linkedin: string[] }> {
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 45_000,
    maxRetries: 1,
  });

  const completion = await client.chat.completions.create({
    model: process.env.DEMO_MODEL || "gpt-4o-mini",
    temperature: 0.85,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write social posts for founders. Direct, specific, fifth-grade reading level. " +
          "Numbers instead of adjectives. No hashtags, no emoji, no 'excited to announce', " +
          "no 'game-changer'. Never invent a statistic, customer, or feature that is not in " +
          "the source text. One idea per post.",
      },
      {
        role: "user",
        content:
          `Here is a company's website:\n\n${brief}\n\n` +
          "Write 3 tweet drafts (under 280 characters each, each a different angle) and " +
          "2 LinkedIn posts (3-5 short paragraphs, first line works alone as a hook).\n\n" +
          'Reply with JSON only: {"tweets": ["…"], "linkedin": ["…"]}',
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { tweets?: unknown; linkedin?: unknown };

  return {
    tweets: toStringArray(parsed.tweets).slice(0, 3),
    linkedin: toStringArray(parsed.linkedin).slice(0, 2),
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}
