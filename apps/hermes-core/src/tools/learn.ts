import type { Tool } from "@/core/types";

/**
 * How an agent writes something down.
 *
 * The alternative was a post-run extraction pass — a second model call over the
 * transcript asking "what did you learn". That is more expensive, arrives after
 * the reasoning that produced the insight has been thrown away, and reliably
 * invents lessons to fill the slot. A tool the model calls at the moment it
 * notices something is cheaper and truer, and the call itself is evidence that
 * the model actually concluded it rather than being asked to confabulate one.
 *
 * The `key` matters more than it looks. It is the dedupe handle: the platform
 * normalises it and folds repeats into a counter, so the same conclusion
 * reached on forty mornings becomes one lesson with forty times the confidence
 * instead of forty rows of near-identical prose. A model that invents a fresh
 * key every run gets a memory full of singletons, which is why the description
 * spends its words on that and not on the obvious fields.
 */
export const rememberTool: Tool = {
  name: "remember",
  description:
    "Write down something you concluded this run so future runs start from it " +
    "instead of re-deriving it. Use it when you notice what works, what fails, " +
    "something true about the audience or a competitor, or how this founder " +
    "wants things written.\n\n" +
    "The `key` is a short reusable label, NOT a description — reuse the exact " +
    "same key when you observe the same thing again, because that is what turns " +
    "a guess into a confident lesson. Good keys: 'question hooks on linkedin', " +
    "'northwind pricing page', 'founder dislikes emoji'. Bad keys: 'observation " +
    "from tuesday', 'insight 3'.\n\n" +
    "Do not record things that are already in your memory block unchanged, and " +
    "do not record the output you just produced — that is a generation, not a " +
    "lesson.",
  parameters: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["worked", "failed", "audience", "competitor", "style", "fact"],
        description:
          "worked: an approach that produced a result. failed: one that did not, " +
          "so stop trying it. audience/competitor/style/fact: something true you " +
          "should not have to look up again.",
      },
      key: {
        type: "string",
        description:
          "Short, lowercase, reusable label. Reuse it verbatim next time you see " +
          "the same thing.",
      },
      summary: {
        type: "string",
        description:
          "The lesson in one sentence, written for a future run that has no " +
          "memory of today.",
      },
      score: {
        type: "number",
        description:
          "How well it went, from -1 (never works) to 1 (always works). Use 0 " +
          "when you are recording a fact rather than an outcome.",
      },
    },
    required: ["kind", "key", "summary"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const kind = String(args.kind ?? "fact");
    const key = String(args.key ?? "").trim();
    const summary = String(args.summary ?? "").trim();

    if (!key || !summary) {
      return "Nothing recorded: a lesson needs both a key and a summary.";
    }

    const allowed = ["worked", "failed", "audience", "competitor", "style", "fact"];
    if (!allowed.includes(kind)) {
      return `Nothing recorded: kind must be one of ${allowed.join(", ")}.`;
    }

    const rawScore = Number(args.score);
    const score = Number.isFinite(rawScore) ? Math.max(-1, Math.min(1, rawScore)) : 0;

    ctx.learn({
      kind: kind as "worked" | "failed" | "audience" | "competitor" | "style" | "fact",
      key: key.slice(0, 120),
      summary: summary.slice(0, 600),
      score,
    });

    ctx.log("learning", { kind, key });

    return `Recorded under "${key}". Future runs will start knowing this.`;
  },
};

/**
 * How an agent edits its own script.
 *
 * The proposal is filed inactive. That split is the entire safety story: a
 * model that can silently rewrite its own instructions has no stable behaviour
 * and no way back, whereas a numbered revision somebody switched on has both.
 * The tool says so in its own description, because an agent that believes its
 * rewrite took effect immediately will spend the next run confused about why
 * it did not.
 */
export const proposePromptChangeTool: Tool = {
  name: "propose_prompt_change",
  description:
    "Propose a rewrite of one of your own prompts, for cases where you have " +
    "repeatedly found your instructions to be wrong, incomplete, or pointed at " +
    "the wrong thing for this particular business.\n\n" +
    "This does NOT take effect now. It is filed as a numbered revision for the " +
    "founder to review and switch on, and you will keep running your current " +
    "prompt until they do. Propose at most one per run, only when you have a " +
    "specific reason you can state, and never to loosen a constraint you were " +
    "given.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Which of your prompts to rewrite, e.g. 'system'.",
      },
      body: {
        type: "string",
        description: "The complete replacement text. Not a diff.",
      },
      reason: {
        type: "string",
        description:
          "Why, in one or two sentences, citing what you actually observed.",
      },
    },
    required: ["name", "body", "reason"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const name = String(args.name ?? "").trim();
    const body = String(args.body ?? "").trim();

    if (!name || !body) {
      return "Nothing proposed: a revision needs a prompt name and a full body.";
    }
    if (!ctx.template.prompts[name]) {
      return (
        `Nothing proposed: this agent has no prompt called "${name}". ` +
        `It has: ${Object.keys(ctx.template.prompts).join(", ")}.`
      );
    }

    ctx.revise({
      name: name.slice(0, 60),
      body: body.slice(0, 20_000),
      reason: String(args.reason ?? "").slice(0, 1_000) || undefined,
    });

    ctx.log("prompt_revision_proposed", { name });

    return (
      `Filed a proposed revision of "${name}" for review. ` +
      "It is not live — keep following your current instructions this run."
    );
  },
};
