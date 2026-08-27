import "server-only";

/**
 * Where models come from, and which ones are free.
 *
 * The founder brings their own key for the work that genuinely needs a strong
 * model. But two things should cost them nothing:
 *
 *   1. **Chatting with their agents.** Unlimited back-and-forth on a free model
 *      run on the platform's own key — their key is never touched for chat.
 *   2. **An admin's whole fleet.** Everything the admin deploys runs on the
 *      free models and the platform key, so the operator is not paying per
 *      agent to run the product they are demonstrating.
 *
 * "Free" here means OpenRouter's `:free` tier. The list is tried in order and
 * the first that answers wins, because a free model can be busy or briefly
 * pulled, and one that is down should fall through to the next rather than fail
 * the request. All of it is env-overridable — a different key, a different set
 * of models, a different endpoint — so nothing here is a hardcoded dead end.
 */

export const OPENROUTER_BASE =
  process.env.OPENROUTER_BASE_URL?.trim() ||
  process.env.OPENAI_BASE_URL?.trim() ||
  "https://openrouter.ai/api/v1";

/** The free models, best-first. Overridable with CHAT_MODELS (comma-separated). */
export const FREE_MODELS: string[] = (
  process.env.CHAT_MODELS?.trim()
    ? process.env.CHAT_MODELS.split(",").map((m) => m.trim())
    : [
        // Ordered by how well they follow a brief, not by size.
        //
        // The first list here was three very small models, and they failed in
        // the way small models do: instead of doing the job they narrated their
        // reasoning, or emitted a tool call for a search tool they had never
        // been given. Marketing work is instruction-following work, so the
        // capable instruct models go first and the tiny ones stay only as a
        // last resort for when the free tier is busy.
        "deepseek/deepseek-chat-v3-0324:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "mistralai/mistral-small-3.2-24b-instruct:free",
        "google/gemma-2-9b-it:free",
        "inclusionai/ling-3.0-tiny:free",
        "nvidia/nemotron-3.5-lightning:free",
      ]
).filter(Boolean);

/**
 * The platform's own model key, used for chat and for an admin's agents.
 *
 * Named broadly because the same key serves both. Falls back through the
 * likely env names so it works whichever one the operator set.
 */
export function platformModelKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.PLATFORM_OPENROUTER_KEY?.trim() ||
    process.env.PLATFORM_MODEL_KEY?.trim() ||
    process.env.DEMO_OPENAI_API_KEY?.trim() ||
    null
  );
}
