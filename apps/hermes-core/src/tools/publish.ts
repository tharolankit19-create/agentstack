import { postTweet, twitterConfigured } from "@/integrations/twitter";
import { linkedinConfigured, postToLinkedIn } from "@/integrations/linkedin";
import { getSecret } from "@/core/secrets";
import type { Tool } from "@/core/types";

/**
 * Publishing and sending are the irreversible things an agent can do, so both
 * are gated twice: the customer's `autoPublish` setting, and an explicit model
 * decision. Drafts are the default, because an agent that posts something
 * wrong on day one never gets a day two.
 */

export const publishTool: Tool = {
  name: "publish",
  description:
    "Publish a finished post to X or LinkedIn. Only use this when the user " +
    "explicitly asks to publish in this run. Drafting does not require this.",
  parameters: {
    type: "object",
    properties: {
      platform: { type: "string", enum: ["twitter", "linkedin"] },
      text: { type: "string", description: "The exact text to publish." },
      replyTo: { type: "string", description: "Tweet ID to reply to (twitter only)." },
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
        `Publishing is off for this agent (Publish automatically = "${mode}"). ` +
        "The draft was not posted. Give it to the user instead, and tell them " +
        "they can turn publishing on in the dashboard."
      );
    }

    if (platform === "twitter") {
      if (!twitterConfigured()) {
        throw new Error("X keys are missing. Add all four in the dashboard, then redeploy.");
      }
      const result = await postTweet(text, {
        replyTo: args.replyTo as string | undefined,
        signal: ctx.signal,
      });
      ctx.emit({ kind: "tweet", content: text, meta: { published: true, ...result } });
      return `Posted to X: ${result.url || result.id}`;
    }

    if (platform === "linkedin") {
      if (!mode.includes("LinkedIn")) {
        return "This agent publishes to X only. Return the LinkedIn draft to the user.";
      }
      if (!linkedinConfigured()) {
        throw new Error("LinkedIn credentials are missing. Add them, then redeploy.");
      }
      const result = await postToLinkedIn(text, { signal: ctx.signal });
      ctx.emit({ kind: "linkedin", content: text, meta: { published: true, ...result } });
      return `Posted to LinkedIn: ${result.url || result.id}`;
    }

    throw new Error(`Unknown platform "${platform}". Use "twitter" or "linkedin".`);
  },
};

export const sendEmailTool: Tool = {
  name: "send_email",
  description:
    "Send an email through Resend. Only use when the user explicitly asks to " +
    "send in this run — drafting an email does not require this tool.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient address." },
      subject: { type: "string" },
      body: { type: "string", description: "Plain text body." },
    },
    required: ["to", "subject", "body"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const mode = ctx.config.autoSend ?? "No — draft only";
    if (mode.startsWith("No")) {
      return (
        "Sending is off for this agent. The draft was not sent — give it to " +
        "the user and tell them they can turn sending on in the dashboard."
      );
    }

    const key = getSecret("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY is missing. Add it, then redeploy.");

    const from = ctx.config.fromEmail;
    if (!from) throw new Error('Set the "Send from" address in this agent\'s settings.');

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [String(args.to)],
        subject: String(args.subject),
        text: String(args.body),
      }),
      signal: ctx.signal ?? AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend ${response.status}: ${detail.slice(0, 200)}`);
    }

    ctx.emit({
      kind: "email",
      content: `To: ${args.to}\nSubject: ${args.subject}\n\n${args.body}`,
      meta: { sent: true },
    });
    return `Sent to ${args.to}.`;
  },
};

export const notifyTool: Tool = {
  name: "notify",
  description:
    "Report to the founder on their own channel — Telegram or Slack. Use for " +
    "anything they should see today: a 1-star review, a competitor price " +
    "change, the summary at the end of a run.",
  parameters: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const message = String(args.message);

    // Telegram first. It is the channel the commander agent reports on, and
    // unlike Slack it needs no workspace — a founder on their phone can have
    // it working in about a minute.
    const telegramToken = getSecret("TELEGRAM_BOT_TOKEN");
    const telegramChat = getSecret("TELEGRAM_CHAT_ID");

    if (telegramToken && telegramChat) {
      const response = await fetch(
        `https://api.telegram.org/bot${telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChat,
            text: message,
            // Plain text on purpose: agent output contains underscores and
            // asterisks often enough that Markdown parsing turns a correct
            // message into a 400 from Telegram.
            disable_web_page_preview: true,
          }),
          signal: ctx.signal ?? AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Telegram returned HTTP ${response.status}. ${body.slice(0, 200)}`,
        );
      }
      ctx.log("notified", { channel: "telegram" });
      return "Sent to Telegram.";
    }

    const webhook = getSecret("SLACK_WEBHOOK_URL");
    if (!webhook) {
      return "No Telegram or Slack channel is configured, so nothing was sent. Include this in your final answer instead.";
    }

    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal: ctx.signal ?? AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`Slack returned HTTP ${response.status}.`);
    ctx.log("notified", { channel: "slack" });
    return "Sent to Slack.";
  },
};
