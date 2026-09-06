import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/plans";
import { lanes, allProviders } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Which model lanes are actually live, and what each one said.
 *
 * The chain is designed to hide provider failures — that is its job — which
 * means a platform running on its seventh choice looks exactly like one running
 * on its first. Fine for a founder, useless for whoever has to keep it fed. So
 * this asks every configured provider one real question and reports the answer.
 *
 * It sends a two-token completion rather than listing models, because a
 * provider can serve a catalogue happily and still refuse to infer — an expired
 * card, an exhausted free tier, a model retired out from under the id we have.
 * Only a completion distinguishes those, and at two tokens on a free model it
 * costs nothing worth measuring.
 *
 * Owner-only: it names environment variables and quotes upstream errors.
 */

interface LaneReport {
  provider: string;
  label: string;
  configured: boolean;
  /** Which env var supplied the key. Names only, never values. */
  keyFrom?: string;
  baseUrl?: string;
  models?: string[];
  ok?: boolean;
  answered?: string;
  detail?: string;
  ms?: number;
}

export async function GET() {
  const session = await requireUser();
  if (!isAdmin(session.profile)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const live = lanes();
  const liveIds = new Set(live.map((lane) => lane.provider.id));

  const reports: LaneReport[] = [];

  for (const lane of live) {
    const keyFrom = lane.provider.envKeys.find((name) => process.env[name]?.trim());
    const started = Date.now();
    const result = await probe(lane);

    reports.push({
      provider: lane.provider.id,
      label: lane.provider.label,
      configured: true,
      keyFrom,
      baseUrl: lane.baseUrl,
      models: lane.models,
      ms: Date.now() - started,
      ...result,
    });
  }

  // The ones with no key are listed too. "Why is Gemini not in the chain" is a
  // question this should answer, and an endpoint that only lists what already
  // works cannot answer it.
  for (const provider of allProviders()) {
    if (liveIds.has(provider.id)) continue;
    reports.push({
      provider: provider.id,
      label: provider.label,
      configured: false,
      detail: `No key. Set one of: ${provider.envKeys.join(", ")}.`,
    });
  }

  const working = reports.filter((r) => r.ok).length;

  return NextResponse.json({
    // The number that matters. One working lane is a working platform; zero is
    // an outage no matter how many keys are set.
    working,
    configured: live.length,
    order: live.map((lane) => lane.provider.id),
    reports,
  });
}

/** One real completion, smallest possible, first model only. */
async function probe(lane: ReturnType<typeof lanes>[number]): Promise<Partial<LaneReport>> {
  const model = lane.models[0];
  if (!model) return { ok: false, detail: "No models configured for this provider." };

  try {
    const response = await fetch(`${lane.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${lane.apiKey}`,
        "content-type": "application/json",
        ...(lane.provider.headers ?? {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
      detail?: string;
      message?: string;
    };

    if (response.ok) {
      const answered = body.choices?.[0]?.message?.content?.trim().slice(0, 60) ?? "";
      return answered
        ? { ok: true, answered }
        : { ok: false, detail: "Answered 200 but with no content." };
    }

    const message =
      typeof body.error === "string"
        ? body.error
        : body.error?.message ?? body.detail ?? body.message ?? "";

    return { ok: false, detail: `${response.status}: ${message || "no message"}` };
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return {
      ok: false,
      detail: timedOut ? "Timed out after 30s." : `Unreachable: ${String(cause)}`,
    };
  }
}
