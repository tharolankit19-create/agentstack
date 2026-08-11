/**
 * The name, the promise, and the one sentence.
 *
 * In one file because a rebrand that lives in forty string literals is a
 * rebrand that is never finished — there is always one page still saying the
 * old name. Everything user-facing reads from here.
 */

import { SITE } from "./site";

export const BRAND = {
  /** Re-exported so there is one name, not two that drift. */
  name: SITE.name,
  short: SITE.short,
  /** The whole product in one line. Used in the hero and the OG image. */
  promise: "Your entire marketing department, reporting to you on Telegram.",
  /** The sharper, riskier version. Used where there is room for one line only. */
  tagline: "An army of marketing agents. One commander. Zero dashboards.",
  /** The neutral one, for tabs and titles. */
  plainTagline: SITE.tagline,
  /**
   * What it is, for someone who has never heard of it. Kept to a sentence
   * because meta descriptions truncate and so do humans.
   */
  description:
    "Six marketing agents that research, write, watch competitors and find leads " +
    "while you sleep — with one head agent that messages you the plan every " +
    "morning on Telegram. You approve, it executes.",
  /**
   * The belief underneath it. This is the line that decides whether someone
   * shares the page, so it says what we are against, not what we do.
   */
  manifesto: "We don't generate AI content. We generate revenue.",
} as const;

/**
 * What the founder brings versus what we bring.
 *
 * This is a real product boundary, not marketing copy, and it is stated in one
 * place because getting it wrong in either direction is expensive: promise
 * their key covers everything and their first bill surprises them; imply we
 * cover the model and ours does.
 */
export const BYOK = {
  /** They pay the model provider directly, at cost, with no markup from us. */
  theirs: [
    "OpenAI, Anthropic, OpenRouter, Groq — whichever you already use",
    "Your Vercel account, where the agents actually run",
  ],
  /** We supply and pay for these, because they are useless one seat at a time. */
  ours: [
    "Telegram — the channel your head agent reports on",
    "Firecrawl — how agents read the web",
    "The orchestration, the prompts, and every agent we ship next",
  ],
} as const;
