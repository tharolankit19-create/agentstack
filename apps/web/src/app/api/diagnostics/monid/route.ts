import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { houseMonidKey, loadConnectors } from "@/lib/connectors";
import { whoami, balance, discover, learnedRoutes, MonidError } from "@/lib/monid";
import { isAdmin } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * What Monid actually said, in one request.
 *
 * "The Monid calls are not happening" was true and unanswerable, because every
 * failure was swallowed: `runCapability` returns `{ ok: false }`, the agent
 * writes its draft without the data, and nothing anywhere records why. From the
 * outside that is indistinguishable from an agent that simply chose not to look
 * anything up.
 *
 * So this exists to make the question answerable without a deploy or a log
 * dive. It runs the three calls that cost nothing — is there a key, does the
 * key work, what is the balance — plus one discover, which is also free, and
 * reports the literal status and message for each along with which route shape
 * won. That last part matters most: the paths were read off a CLI bundle and
 * never verified against the live service, and `lib/monid.ts` now tries several
 * shapes, so this says which one is real.
 *
 * Deliberately does not start a run. A run spends money, and a diagnostic that
 * bills you is a diagnostic people stop running.
 *
 * Owner-only. The response names environment variables and quotes upstream
 * error messages, neither of which belongs in a customer's hands.
 */

interface Step {
  step: string;
  ok: boolean;
  detail: string;
  status?: number;
  code?: string;
}

export async function GET() {
  const session = await requireUser();
  if (!isAdmin(session.profile)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const steps: Step[] = [];

  // 1. Is there a key at all, and where did it come from? This is the single
  //    most common cause and the one nobody thinks to check.
  const connectors = await loadConnectors(admin, session.userId);
  const owner = connectors.monid ?? null;
  const house = await houseMonidKey(admin);
  const key = owner ?? house;

  steps.push({
    step: "key",
    ok: Boolean(key),
    detail: key
      ? `Found via ${owner ? "your connectors page" : "the platform (MONID_API_KEY or the owner's connector)"}. ` +
        `Starts "${key.slice(0, 8)}…", ${key.length} characters.`
      : "No key anywhere. Set MONID_API_KEY in the platform environment, or connect Monid on the Connectors page.",
  });

  if (!key) {
    return NextResponse.json({ ok: false, steps, learned: learnedRoutes() });
  }

  // 2. Does the key work? Free.
  const auth = await attempt("whoami", () => whoami(key).then((ok) => (ok ? "accepted" : "rejected")));
  steps.push(auth);

  // 3. What is left to spend? Free, and an empty balance looks exactly like a
  //    broken integration from the agent's side — every run fails, no output.
  steps.push(await attempt("balance", async () => JSON.stringify(await balance(key)).slice(0, 400)));

  // 4. Can we find an endpoint? Free, and the first call that actually exercises
  //    the catalogue rather than the account.
  steps.push(
    await attempt("discover", async () => {
      const found = await discover(key, "b2b people search company employees", { limit: 3 });
      if (!found.length) return "The call succeeded but returned no endpoints.";
      return found
        .map((e) => `${e.provider}/${e.endpoint} (${e.metrics?.health ?? "health unknown"})`)
        .join(", ");
    }),
  );

  return NextResponse.json({
    ok: steps.every((s) => s.ok),
    baseUrl: process.env.MONID_BASE_URL?.trim() || "https://api.monid.ai",
    // Which route shape won, per operation. An operation missing from here was
    // never reached; an index above 0 means the shape this was built against
    // was wrong and the fallback saved it.
    learned: learnedRoutes(),
    steps,
  });
}

/**
 * Run one step and report what happened, never throwing.
 *
 * The point of a diagnostic is the message on the failing step, so a thrown
 * error here would destroy the only thing worth having.
 */
async function attempt(step: string, work: () => Promise<string>): Promise<Step> {
  try {
    return { step, ok: true, detail: await work() };
  } catch (cause) {
    if (cause instanceof MonidError) {
      return {
        step,
        ok: false,
        detail: cause.message,
        status: cause.status,
        code: cause.code,
      };
    }
    return { step, ok: false, detail: cause instanceof Error ? cause.message : String(cause) };
  }
}
