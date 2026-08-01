import { NextResponse } from "next/server";
import { loadTemplate } from "@/templates/loader";
import { availableSecrets } from "@/core/secrets";
import { isPaused } from "@/core/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated, and deliberately dull: the dashboard polls this to
 * turn a deployment green. It reports names of configured secrets, never values.
 */
export async function GET() {
  try {
    const template = await loadTemplate();
    const secrets = availableSecrets();
    const missing = template.config.secrets
      .filter((spec) => spec.required && !secrets.includes(spec.key))
      .map((spec) => spec.key);

    return NextResponse.json({
      status: missing.length === 0 ? "ready" : "misconfigured",
      agentId: process.env.AGENT_ID ?? null,
      template: {
        id: template.config.id,
        name: template.config.name,
        frequency: template.config.frequency,
        tools: template.tools.map((t) => t.name),
      },
      paused: isPaused(),
      secretsConfigured: secrets,
      secretsMissing: missing,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
    });
  } catch (cause) {
    return NextResponse.json(
      {
        status: "error",
        error: cause instanceof Error ? cause.message : String(cause),
      },
      { status: 500 },
    );
  }
}
