import { getTemplate, type AgentTemplate } from "./templates";
import type { Agent, CustomAgent } from "./supabase/types";

/**
 * One shape for both kinds of agent.
 *
 * The UI should not care whether an agent came from the bundled catalog or was
 * generated from a customer's own SaaS, so this presents a generated spec as an
 * `AgentTemplate`. Every dashboard screen renders the result identically.
 */
export function templateForAgent(
  agent: Agent,
  customAgent?: CustomAgent | null,
): AgentTemplate | undefined {
  if (!agent.custom_agent_id) return getTemplate(agent.template_id);

  const spec = customAgent?.spec;
  if (!spec) return undefined;

  const needsServiceKey = Boolean(spec.api?.baseUrl);

  return {
    id: "custom-agent",
    name: spec.name,
    description: spec.description,
    category: "Custom",
    icon: "🧩",
    replaces: spec.replaces,
    frequency: "0 9 * * 1-5",
    model: "gpt-4o-mini",
    temperature: 0.6,
    maxIterations: 10,
    tools: [],
    prompts: ["system"],
    scheduledTask: spec.scheduledTask,
    examples: spec.examples,
    // Generated agents have no settings form: everything they need to know is
    // already baked into the prompt the builder wrote.
    settings: [],
    secrets: [
      { key: "OPENAI_API_KEY", label: "OpenAI API key", required: true },
      ...(needsServiceKey
        ? [
            {
              key: "SERVICE_API_KEY",
              label: `${spec.name} API key`,
              help: `Used to call ${spec.api?.baseUrl}. Encrypted before it is stored.`,
              required: true,
            },
          ]
        : []),
    ],
  };
}
