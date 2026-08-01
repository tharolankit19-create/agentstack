import { postTweet, twitterConfigured } from "@/integrations/twitter";
import { linkedinConfigured, postToLinkedIn } from "@/integrations/linkedin";
import type { Tool } from "@/core/types";

/**
 * Publishing is the one irreversible thing this agent can do, so it is gated
 * twice: the founder's `autoPublish` setting, and an explicit model decision.
 * Drafts are the default because an agent that tweets something wrong on day
 * one never gets a day two.
 */
export const publisherTool: Tool = {
  name: "publish",
  description:
    "Publish a finished post to X or LinkedIn. Only use this when the user " +
    "explicitly asks to publish in this run. Drafting does not require this tool.",
  parameters: {
    type: "object",
    properties: {
      platform: {
        type: "string",
        enum: ["twitter", "linkedin"],
        description: "Where to publish.",
      },
      text: { type: "string", description: "The exact text to publish." },
      replyTo: {
        type: "string",
        description: "Optional tweet ID to reply to (twitter only).",
      },
    },
    required: ["platform", "text"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const platform = String(args.platform ?? "");
    const text = String(args.text ?? "").trim();
    if (!text) throw new Error("Nothing to publish — text was empty.");

    const mode = ctx.config.autoPublish ?? "No — draft only";
    if (mode.startsWith("No")) {
      return (
        "Publishing is off for this agent (Publish automatically = " +
        `"${mode}"). The draft was not posted. Return it to the user instead, ` +
        "and tell them they can enable publishing in the dashboard."
      );
    }
    if (platform === "linkedin" && !mode.includes("LinkedIn")) {
      return (
        "This agent is set to publish to X only. The LinkedIn draft was not " +
        "posted — return it to the user."
      );
    }

    if (platform === "twitter") {
      if (!twitterConfigured()) {
        throw new Error(
          "X keys are missing. Add all four X credentials in the dashboard and redeploy.",
        );
      }
      const result = await postTweet(text, {
        replyTo: args.replyTo as string | undefined,
        signal: ctx.signal,
      });
      ctx.emit({ kind: "tweet", content: text, meta: { published: true, ...result } });
      ctx.log("published", { platform, id: result.id });
      return `Posted to X: ${result.url || result.id}`;
    }

    if (platform === "linkedin") {
      if (!linkedinConfigured()) {
        throw new Error(
          "LinkedIn credentials are missing. Add the access token and author URN, then redeploy.",
        );
      }
      const result = await postToLinkedIn(text, { signal: ctx.signal });
      ctx.emit({
        kind: "linkedin",
        content: text,
        meta: { published: true, ...result },
      });
      ctx.log("published", { platform, id: result.id });
      return `Posted to LinkedIn: ${result.url || result.id}`;
    }

    throw new Error(`Unknown platform "${platform}". Use "twitter" or "linkedin".`);
  },
};
