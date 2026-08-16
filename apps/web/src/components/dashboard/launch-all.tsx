"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";

/**
 * One button that starts the entire army.
 *
 * The founder's complaint was exact: they deployed the head agent and expected
 * the team to come with it, then found agents sitting in draft waiting for
 * individual clicks nobody told them about. Deploying is not a decision they
 * want to make fourteen times — it is one decision, made once.
 *
 * Deploys arrive in batches because each one uploads a runtime and waits for a
 * build; the loop keeps asking until the server says there is nothing left, and
 * shows real progress rather than a spinner that could mean anything.
 */
export function LaunchAll({ pending }: { pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setBusy(true);
    setError(null);
    setDone(0);
    try {
      for (let round = 0; round < 12; round += 1) {
        const response = await fetch("/api/army/launch", { method: "POST" });
        const payload = (await response.json()) as {
          deployed: number;
          remaining: number;
          done: boolean;
          failed?: { name: string; reason: string }[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Could not start them.");

        setDone((n) => n + payload.deployed);

        if (payload.failed?.length) {
          setError(`${payload.failed[0].name}: ${payload.failed[0].reason}`);
          break;
        }
        if (payload.done) break;
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-accent bg-accent/[0.06] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-fg-strong">
            {pending} {pending === 1 ? "agent is" : "agents are"} not working yet
          </p>
          <p className="mt-0.5 text-sm text-muted">
            One click starts all of them. They run on their own schedule from
            then on — you never deploy anything again.
          </p>
        </div>
        <button
          type="button"
          onClick={launch}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {busy ? `Starting… ${done}` : "Start all my agents"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
