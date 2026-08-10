"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Server, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { HostingStatus } from "@/lib/user-hosting";

/**
 * Connect your own Vercel account.
 *
 * On Starter and Unlimited the agents run on the customer's infrastructure,
 * which is a selling point right up until it becomes a setup step. So this is
 * deliberately one field, one button, and one sentence explaining the trade —
 * and it validates against Vercel on submit, so a wrong token is rejected here
 * with a readable reason rather than three screens later inside a failed
 * deploy.
 *
 * The token is never rendered back. Once connected, all the customer sees is
 * which account it was, which is the only part they need in order to know it
 * is the right one.
 */
export function HostingCard({ initial }: { initial: HostingStatus }) {
  const [status, setStatus] = useState(initial);
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState(initial.teamId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Managed hosting: nothing to do, and saying so is better than hiding it.
  if (!status.selfHosted) {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <p className="flex items-center gap-2 font-bold text-fg-strong">
          <Check className="size-4 text-live" aria-hidden />
          We host your agents
        </p>
        <p className="mt-1 text-sm text-muted">
          Nothing to connect and nothing to maintain — that is what your plan is
          for. Deploy is one click.
        </p>
      </div>
    );
  }

  async function connect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/hosting/vercel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim(), teamId: teamId.trim() || undefined }),
      });
      const payload = (await response.json()) as HostingStatus & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not connect that account.");

      setStatus(payload);
      setToken("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);
    setError(null);
    try {
      await fetch("/api/hosting/vercel", { method: "DELETE" });
      setStatus({ ...status, connected: false, accountLabel: null, connectedAt: null, needsToken: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        status.needsToken ? "border-money/40 bg-[var(--money-wash)]" : "border-line bg-surface-2"
      }`}
    >
      <p className="flex items-center gap-2 font-bold text-fg-strong">
        <Server className="size-4 text-accent" aria-hidden />
        Your hosting
      </p>

      {status.connected ? (
        <>
          <p className="mt-1.5 text-sm text-muted">
            Agents deploy to{" "}
            <span className="font-semibold text-fg">{status.accountLabel}</span>.
            They run on your account, under your own API keys — we never hold a
            key that can spend your money.
          </p>
          <Button
            onClick={disconnect}
            disabled={pending}
            variant="ghost"
            size="sm"
            className="mt-4 text-muted hover:text-fg-strong"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Unplug />}
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Your plan runs agents on your own infrastructure, so we need a Vercel
            token to deploy them there. A free Vercel account is enough.{" "}
            <a
              href="https://vercel.com/account/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
            >
              Create one
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>

          <div className="mt-4 space-y-2">
            <Input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Vercel API token"
              aria-label="Vercel API token"
              type="password"
              autoComplete="off"
            />
            <Input
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              placeholder="Team ID (optional — leave blank for your personal account)"
              aria-label="Vercel team ID"
              autoComplete="off"
            />
          </div>

          <Button
            onClick={connect}
            disabled={pending || token.trim().length < 20}
            size="sm"
            className="mt-3"
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Connect Vercel
          </Button>

          <p className="mt-3 text-xs text-faint">
            Encrypted before it is stored, and only ever decrypted at the moment
            of a deploy. We check it works before saving it.
          </p>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
