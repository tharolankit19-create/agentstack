import { generateText } from "@/integrations/openai";
import { render } from "@/core/render";
import type { Generation, GenerationKind, Tool } from "@/core/types";

/**
 * Write something using one of the template's prompt files.
 *
 * Keeping generation in its own low-temperature call rather than letting the
 * main loop free-write means the prompt's constraints — never invent a
 * statistic, never promise a ship date — cannot be diluted by a long tool
 * transcript sitting above them.
 */
export const draftTool: Tool = {
  name: "draft",
  description:
    "Write a piece of content using one of this agent's built-in prompts. " +
    "Pass the prompt name and whatever source material you gathered. Returns " +
    "the draft and saves it to the customer's dashboard.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Which built-in prompt to use. Call list_prompts if you are unsure.",
      },
      kind: {
        type: "string",
        enum: [
          "tweet",
          "linkedin",
          "email",
          "review_reply",
          "article",
          "report",
          "note",
        ],
        description: "What kind of output this is, for the dashboard.",
      },
      source: {
        type: "string",
        description:
          "Everything the prompt should be written from — page text, API " +
          "results, the review being replied to.",
      },
      instructions: {
        type: "string",
        description: "Any extra steer for this specific draft.",
      },
    },
    required: ["prompt", "source"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const name = String(args.prompt ?? "").trim();
    const template = ctx.template;
    const body = template.prompts[name];

    if (!body) {
      const available = Object.keys(template.prompts).join(", ");
      throw new Error(
        `No prompt named "${name}" in this agent. Available prompts: ${available}.`,
      );
    }

    const filled = render(body, {
      ...ctx.config,
      source: String(args.source ?? ""),
      brief: String(args.source ?? ""),
    });

    const text = await generateText({
      model: process.env.AGENT_MODEL || template.config.model,
      temperature: template.config.temperature,
      system: render(template.prompts.system ?? "", ctx.config),
      user: args.instructions
        ? `${filled}\n\nExtra instruction for this draft: ${args.instructions}`
        : filled,
      signal: ctx.signal,
    });

    const generation: Generation = {
      kind: (args.kind as GenerationKind) ?? "note",
      content: text,
      meta: { prompt: name },
    };
    ctx.emit(generation);
    ctx.log("drafted", { prompt: name, kind: generation.kind });

    return text;
  },
};

/** Lets the model discover what it can write without guessing prompt names. */
export const listPromptsTool: Tool = {
  name: "list_prompts",
  description:
    "List the built-in prompts this agent can write with, and what each is for.",
  parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  async run(_args, ctx) {
    const names = Object.keys(ctx.template.prompts).filter((n) => n !== "system");
    if (names.length === 0) return "This agent has no named prompts.";

    return names
      .map((name) => {
        // The first line of each prompt file doubles as its description.
        const firstLine = (ctx.template.prompts[name] ?? "").split("\n")[0];
        return `- ${name}: ${firstLine}`;
      })
      .join("\n");
  },
};
