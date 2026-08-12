import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOperatorApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCustomAgent, safeUrl } from "@/lib/custom-agent";
import { canBuildCustom } from "@/lib/plans";
import { openSecrets } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import type { CustomAgent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sourceUrl: z.string().min(3).max(300),
  apiBaseUrl: z.string().max(300).optional(),
  apiKey: z.string().max(500).optional(),
  openaiKey: z.string().max(500).optional(),
});

/**
 * Builds an agent from a SaaS the customer already pays for.
 *
 * Pro only — this is the thing the plan is for. The customer's own OpenAI key
 * pays for the generation when they have given us one; the platform key is the
 * fallback so a first-time Pro customer is not blocked on setup.
 */
export async function POST(request: Request) {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  if (!canBuildCustom(auth.session.profile)) {
    return NextResponse.json(
      {
        error:
          "Building agents from your own tools is on Pro. Upgrade and paste any tool's URL.",
        code: "upgrade_required",
      },
      { status: 403 },
    );
  }

  // Each build reads up to seven pages and makes a long model call.
  const limit = rateLimit(`custom:${auth.session.userId}`, 10, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is ten builds this hour. Give it a few minutes." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give the URL of the tool you want to replace." },
      { status: 400 },
    );
  }

  let sourceUrl: string;
  try {
    sourceUrl = safeUrl(parsed.data.sourceUrl).toString();
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "That URL is not valid." },
      { status: 400 },
    );
  }

  const openaiKey =
    parsed.data.openaiKey?.trim() ||
    (await borrowExistingOpenAiKey(auth.session.userId)) ||
    process.env.DEMO_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json(
      { error: "Add your OpenAI key first — the builder needs it to write the agent." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: row, error: insertError } = await admin
    .from("custom_agents")
    .insert({
      user_id: auth.session.userId,
      source_url: sourceUrl,
      source_name: new URL(sourceUrl).host,
      status: "analyzing",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !row) {
    console.error("[custom-agents] could not create the row:", insertError);
    return NextResponse.json({ error: "Could not start the build." }, { status: 500 });
  }

  try {
    const { spec, sources } = await buildCustomAgent({
      sourceUrl,
      apiBaseUrl: parsed.data.apiBaseUrl,
      hasApiKey: Boolean(parsed.data.apiKey),
      openaiKey,
    });

    await admin
      .from("custom_agents")
      .update({ status: "ready", spec, sources, error: null })
      .eq("id", row.id);

    return NextResponse.json({ id: row.id, spec, sources }, { status: 201 });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Could not read that product.";
    console.error("[custom-agents] build failed:", cause);

    await admin
      .from("custom_agents")
      .update({ status: "failed", error: message })
      .eq("id", row.id);

    return NextResponse.json({ error: message, id: row.id }, { status: 502 });
  }
}

/** Lists the customer's generated agents. */
export async function GET() {
  const auth = await requireOperatorApiUser();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_agents")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ customAgents: (data ?? []) as CustomAgent[] });
}

/**
 * Reuses an OpenAI key the customer already gave another agent.
 *
 * They should not have to paste the same key a second time to use a feature
 * they are already paying for.
 */
async function borrowExistingOpenAiKey(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agent_secrets")
    .select("ciphertext")
    .eq("user_id", userId)
    .limit(5);

  for (const row of data ?? []) {
    const ciphertext = (row as { ciphertext: string }).ciphertext;
    if (!ciphertext) continue;
    try {
      const key = openSecrets(ciphertext).OPENAI_API_KEY;
      if (key) return key;
    } catch {
      /* a row we cannot open is a row we skip */
    }
  }
  return null;
}
