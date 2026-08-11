import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { TEMPLATES, TOTAL_MONTHLY_REPLACED, formatUsd } from "@/lib/templates";
import { PLAN_LIST } from "@/lib/plans";
import type { SupportMessage } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().min(1).max(4_000) });

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * The support agent.
 *
 * Runs on the platform's Gemini key, not the customer's — this is our support
 * cost, and a founder who is stuck should not have to configure something to
 * get unstuck. It knows the catalog, the plans, and the customer's own state,
 * so it can answer "which agent should I use" concretely instead of pointing
 * at documentation.
 *
 * What it must not do is invent. The system prompt is explicit that it hands
 * off rather than guessing, because a confident wrong answer in support costs
 * more than a slow one.
 */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The assistant is not configured yet. Add GEMINI_API_KEY and it turns on.",
      },
      { status: 503 },
    );
  }

  const limit = rateLimit(`support:${auth.session.userId}`, 40, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of questions this hour. Give it a few minutes." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ask something first." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: history } = await admin
    .from("support_messages")
    .select("role, content")
    .eq("user_id", auth.session.userId)
    .order("created_at", { ascending: true })
    .limit(20);

  const { data: agents } = await admin
    .from("agents")
    .select("name, template_id, status, paused")
    .eq("user_id", auth.session.userId)
    .limit(30);

  try {
    const reply = await askGemini({
      apiKey,
      system: systemPrompt({
        firstName: auth.session.profile.full_name?.split(" ")[0] ?? null,
        plan: auth.session.profile.plan,
        problems: auth.session.profile.problems ?? [],
        agents: (agents ?? []) as {
          name: string;
          template_id: string;
          status: string;
          paused: boolean;
        }[],
      }),
      history: (history ?? []) as Pick<SupportMessage, "role" | "content">[],
      message: parsed.data.message,
    });

    await admin.from("support_messages").insert([
      { user_id: auth.session.userId, role: "user", content: parsed.data.message },
      { user_id: auth.session.userId, role: "assistant", content: reply },
    ]);

    return NextResponse.json({ reply });
  } catch (cause) {
    console.error("[support] failed:", cause);
    return NextResponse.json(
      { error: "The assistant could not answer. Try again in a moment." },
      { status: 502 },
    );
  }
}

/** Clears the conversation. */
export async function DELETE() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  await createAdminClient()
    .from("support_messages")
    .delete()
    .eq("user_id", auth.session.userId);

  return NextResponse.json({ ok: true });
}

function systemPrompt(context: {
  firstName: string | null;
  plan: string;
  problems: string[];
  agents: { name: string; template_id: string; status: string; paused: boolean }[];
}): string {
  const catalog = TEMPLATES.map(
    (template) =>
      `- ${template.name} (${template.id}) — ${template.description} Replaces ${template.replaces.tools.join(", ")}, about $${template.replaces.monthlyUsd}/mo.`,
  ).join("\n");

  // Every plan has the whole library — the tiers differ on count and hosting.
  // Spelled out because the model will otherwise invent a per-plan agent list,
  // which is the single most damaging thing it could tell a prospect.
  const plans = PLAN_LIST.map(
    (plan) =>
      `- ${plan.name}: $${plan.priceUsd}/month, ${plan.quotaLabel} running at once, chosen freely from the entire library. ` +
      `${plan.hosting === "managed" ? "We host them; no deploy step." : "Runs on their own infrastructure and their own API keys."}` +
      `${plan.customAgents ? " Can build custom agents from any tool's URL." : ""}`,
  ).join("\n");

  const theirs =
    context.agents.length > 0
      ? context.agents
          .map(
            (agent) =>
              `- ${agent.name} (${agent.template_id}): ${agent.status}${agent.paused ? ", paused" : ""}`,
          )
          .join("\n")
      : "They have not set up any agents yet.";

  return `You are the support agent inside Marketing Agents Army (MAA). You help founders get unstuck, fast.

MAA is a marketing team made of agents. Six squads — research, content, competitor intel, trends, cold outreach, reputation — run on the founder's own Vercel account under their own model key. A head agent compiles what they produced and messages the founder on Telegram at a time they choose; the founder replies to approve. Nothing posts, sends or spends without that approval. On the Army and Commander tiers they can also paste any tool's URL and we generate an agent for that tool's job.

## The library

${catalog}

Replacing the whole library is about ${formatUsd(TOTAL_MONTHLY_REPLACED)}/month of software.

## Plans

${plans}

Every plan includes the entire library and every squad shipped after they join,
at no extra cost. Never tell someone a plan restricts *which* agents they can
have — it does not. The only limit is how many run at once.

Every tier is self-hosted and bring-your-own-key: agents deploy to the
founder's own Vercel account and use their own OpenAI/Anthropic/OpenRouter
key, which they pay for directly at cost. We supply Telegram and Firecrawl.
Never tell a customer we host their agents or that we cover their model costs.

Billing is monthly and cancels in one click from the Deployments page. When a subscription lapses, agents pause but nothing is deleted — resubscribing turns them all back on.

## Who you are talking to

Name: ${context.firstName ?? "not given"}
Plan: ${context.plan === "none" ? "no plan yet" : context.plan}
What they told us they struggle with: ${context.problems.join(", ") || "not given"}
Their agents:
${theirs}

## How to answer

- Short. Two or three sentences unless they asked for steps.
- Recommend a specific agent by name when it fits what they described. You know what they are struggling with — use it.
- If they have no plan and ask how to turn something on, tell them plainly that deploying needs a plan and which one fits.
- Give the exact click path when they are lost: "Dashboard → the agent's card → Configure".
- If you do not know, say so and tell them to email support. Never invent a feature, a setting, a price, or a menu that is not listed above.
- Never ask for an API key, a password, or a card number. You never need them.
- No "I'm sorry to hear that". No "Great question". Answer the question.`;
}

async function askGemini(input: {
  apiKey: string;
  system: string;
  history: { role: string; content: string }[];
  message: string;
}): Promise<string> {
  const contents = [
    ...input.history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    { role: "user", parts: [{ text: input.message }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Header rather than a query parameter, so the key cannot end up in
        // an access log or a proxy's URL history.
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}
