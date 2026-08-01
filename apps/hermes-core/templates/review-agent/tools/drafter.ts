import { generateText } from "@/integrations/openai";
import { loadTemplate } from "@/templates/loader";
import { render } from "@/core/agent";
import type { Tool } from "@/core/types";

/**
 * Drafts one reply.
 *
 * This runs the template's `reply.txt` through a separate, low-temperature
 * call rather than letting the main loop free-write. The reply prompt carries
 * the promise-nothing constraints, and keeping it in its own call means those
 * constraints cannot be diluted by a long tool transcript.
 */
export const drafterTool: Tool = {
  name: "draft_reply",
  description:
    "Draft a public reply to one review. Call once per unanswered review. " +
    "Returns the reply text — it is never posted anywhere automatically.",
  parameters: {
    type: "object",
    properties: {
      review: { type: "string", description: "The full review text." },
      rating: { type: "number", description: "Star rating out of 5, if known." },
      author: { type: "string", description: "Reviewer's name, if known." },
      reviewId: { type: "string", description: "Id from check_reviews, if known." },
    },
    required: ["review"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const review = String(args.review ?? "").trim();
    if (!review) throw new Error("No review text was provided.");

    const rating = typeof args.rating === "number" ? args.rating : null;
    const author = String(args.author ?? "") || "Anonymous";

    const template = await loadTemplate();
    const prompt = render(template.prompts.reply ?? "", {
      ...ctx.config,
      brandName: ctx.config.brandName ?? "the product",
      brandTone: ctx.config.brandTone ?? "Warm",
      signature: ctx.config.signature ?? "",
      rating: rating === null ? "unknown" : String(rating),
      author,
      review,
    });

    const reply = await generateText({
      model: process.env.AGENT_MODEL || template.config.model,
      temperature: 0.4,
      system: `You write public replies to customer reviews for ${
        ctx.config.brandName ?? "the product"
      }. You never promise dates, refunds, discounts, or unshipped features.`,
      user: prompt,
      signal: ctx.signal,
    });

    const flagged = shouldFlag(rating, ctx.config.escalateBelow);
    ctx.emit({
      kind: "review_reply",
      content: reply,
      meta: {
        reviewId: args.reviewId ?? null,
        rating,
        author,
        flagged,
        review: review.slice(0, 500),
      },
    });
    ctx.log("reply.drafted", { rating, flagged });

    return flagged
      ? `FLAGGED — send this one yourself (${rating}/5):\n\n${reply}`
      : reply;
  },
};

function shouldFlag(rating: number | null, threshold?: string): boolean {
  if (rating === null || !threshold || threshold === "Never flag") return false;
  const limit = Number.parseInt(threshold, 10);
  return Number.isFinite(limit) && rating <= limit;
}
