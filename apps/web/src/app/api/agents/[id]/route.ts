import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTemplate, validateSecrets, validateSettings } from "@/lib/templates";
import { openSecrets, sealSecrets } from "@/lib/crypto";
import { VercelError } from "@/lib/vercel";
import { vercelClientFor } from "@/lib/user-hosting";
import type { Agent } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Saves settings and API keys.
 *
 * Keys are merged, not replaced: an empty field means "keep the one I already
 * gave you", so a customer editing their tone does not have to re-paste an
 * OpenAI key they cannot read back.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  const template = requireTemplate(agent.template_id);

  const settings = validateSettings(template, {
    ...agent.config,
    ...(parsed.data.config ?? {}),
  });
  if (!settings.ok) {
    return NextResponse.json({ errors: settings.errors }, { status: 400 });
  }

  const incomingSecrets = validateSecrets(
    template,
    parsed.data.secrets ?? {},
    agent.secret_keys ?? [],
  );
  if (!incomingSecrets.ok) {
    return NextResponse.json({ errors: incomingSecrets.errors }, { status: 400 });
  }

  // The admin client is the only one that can touch agent_secrets.
  const admin = createAdminClient();
  let secretKeys = agent.secret_keys ?? [];

  if (Object.keys(incomingSecrets.values).length > 0) {
    const { data: existingRow } = await admin
      .from("agent_secrets")
      .select("ciphertext, agent_token_hash, agent_token_enc")
      .eq("agent_id", agent.id)
      .maybeSingle<{
        ciphertext: string;
        agent_token_hash: string | null;
        agent_token_enc: string | null;
      }>();

    let current: Record<string, string> = {};
    if (existingRow?.ciphertext) {
      try {
        current = openSecrets(existingRow.ciphertext);
      } catch (cause) {
        console.error("[agents] could not open stored secrets:", cause);
        return NextResponse.json(
          { error: "Stored keys could not be read. Re-enter them all." },
          { status: 500 },
        );
      }
    }

    const merged = { ...current, ...incomingSecrets.values };
    const { error: secretError } = await admin.from("agent_secrets").upsert(
      {
        agent_id: agent.id,
        user_id: agent.user_id,
        ciphertext: sealSecrets(merged),
        agent_token_hash: existingRow?.agent_token_hash ?? null,
        agent_token_enc: existingRow?.agent_token_enc ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" },
    );

    if (secretError) {
      console.error("[agents] could not store secrets:", secretError);
      return NextResponse.json({ error: "Could not save your keys." }, { status: 500 });
    }

    secretKeys = Object.keys(merged);
  }

  const missingRequired = template.secrets
    .filter((spec) => spec.required && !secretKeys.includes(spec.key))
    .map((spec) => spec.label);

  const { error: updateError } = await supabase
    .from("agents")
    .update({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      config: settings.values,
      secret_keys: secretKeys,
      status:
        agent.status === "deployed" || agent.status === "deploying"
          ? agent.status
          : missingRequired.length === 0
            ? "configured"
            : "draft",
    })
    .eq("id", agent.id);

  if (updateError) {
    console.error("[agents] update failed:", updateError);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    readyToDeploy: missingRequired.length === 0,
    missing: missingRequired,
  });
}

/**
 * Deletes an agent and tears down its deployment.
 *
 * The Vercel project goes first. Deleting the row first and failing on the
 * teardown would leave a running agent nobody owns, still burning the
 * customer's OpenAI key on a schedule with no way to stop it from the UI.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePaidApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, user_id, vercel_project_id")
    .eq("id", id)
    .maybeSingle<Pick<Agent, "id" | "user_id" | "vercel_project_id">>();

  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (agent.vercel_project_id) {
    try {
      const vercel = await vercelClientFor(agent.user_id);
      await vercel.deleteProject(agent.vercel_project_id);
    } catch (cause) {
      // A project that is already gone is a success, not a failure.
      const alreadyGone = cause instanceof VercelError && cause.status === 404;
      if (!alreadyGone) {
        console.error("[agents] could not tear down the deployment:", cause);
        return NextResponse.json(
          {
            error:
              "Could not shut the deployment down, so the agent was kept. Try again in a moment.",
          },
          { status: 502 },
        );
      }
    }
  }

  // Secrets, runs, generations and chat cascade from the agents row.
  const { error } = await supabase.from("agents").delete().eq("id", agent.id);

  if (error) {
    return NextResponse.json({ error: "Could not delete that agent." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
