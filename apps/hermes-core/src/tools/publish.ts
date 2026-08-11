import { getSecret } from "@/core/secrets";
import type { Tool } from "@/core/types";

/**
 * Publishing and sending are the irreversible things an agent can do.
 *
 * Posting is now manual with no override: `queue_post` hands the finished text
 * to the founder and never touches X or LinkedIn. Email still sends, because
 * an outreach sequence a human presses send on one message at a time is not a
 * sequence — but it stays gated on the customer's own setting and an explicit
 * model decision.
 */

export const publishTool: Tool = {
  name: "queue_post",
  description:
    "Hand a finished post to the founder to publish themselves. Use this when " +
    "a post is ready for X or LinkedIn. It does not publish — it puts the post " +
    "in their queue and the head agent sends it to them.",
  parameters: {
    type: "object",
    properties: {
      platform: { type: "string", enum: ["twitter", "linkedin"] },
      text: { type: "string", description: "The exact text, ready to paste." },
    },
    required: ["platform", "text"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const platform = String(args.platform ?? "");
    const text = String(args.text ?? "").trim();
    if (!text) throw new Error("Nothing to queue — text was empty.");

    // Posting is manual, deliberately and without an override.
    //
    // There used to be an `autoPublish` setting that let an agent post to X and
    // LinkedIn on its own. It is gone, and no code path here reaches a platform
    // API any more. Two reasons, and the second is the one that decided it:
    //
    //   1. An agent that posts something wrong on day one never gets a day two,
    //      and the founder's account is the thing carrying the damage.
    //   2. Both platforms treat automated posting as a policy question. A
    //      product that gets its customers' accounts restricted has sold them a
    //      liability, whatever the feature list said.
    //
    // So the agent writes, the founder posts. The queue below is what makes
    // that one action instead of a hunt through a dashboard.
    ctx.emit({
      kind: platform === "linkedin" ? "linkedin" : "tweet",
      content: text,
      meta: { platform, readyToPost: true, published: false },
    });

    return (
      `Queued for ${platform === "linkedin" ? "LinkedIn" : "X"}. It is waiting ` +
      "for the founder to post it — include it in your final answer so they " +
      "can see it, and do not claim it has been published."
    );
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
