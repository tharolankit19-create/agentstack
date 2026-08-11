"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageCircle, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Connecting Telegram, in one code.
 *
 * The head agent's entire promise is that it messages you, so this is the one
 * setup step that cannot be skipped — which means it has to be the shortest
 * one in the product. Three lines: open the bot, send the code, done.
 *
 * The code is issued on demand rather than shown permanently, because it is a
 * credential: whoever sends it owns the link. Fifteen minutes, single use, and
 * the panel says so rather than leaving someone to wonder why an old code
 * stopped working.
 */

interface LinkState {
  connected: boolean;
  linkedAt: string | null;
  code: string | null;
  expiresAt: string | null;
  botUsername: string | null;
}

export function TelegramCard() {
  const [state, setState] = useState<LinkState | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/telegram/link")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setState(data as LinkState))
      .catch(() => setError("Could not load your Telegram status."));
  }, []);

  async function issueCode() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/link", { method: "POST" });
      const payload = (await response.json()) as LinkState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create a code.");
      setState({ ...(state ?? { connected: false, linkedAt: null }), ...payload });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setState({
        connected: false,
        linkedAt: null,
        code: null,
        expiresAt: null,
        botUsername: state?.botUsername ?? null,
      });
    } finally {
      setPending(false);
    }
  }

  if (!state) {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Checking Telegram…
        </p>
      </div>
    );
  }

  if (state.connected) {
    return (
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <p className="flex items-center gap-2 font-bold text-fg-strong">
          <Check className="size-4 text-live" aria-hidden />
          Telegram connected
        </p>
        <p className="mt-1.5 text-sm text-muted">
          Your briefing lands here every day at the time set on the Head Agent.
          Reply <span className="font-semibold text-fg">1</span> to approve,{" "}
          <span className="font-semibold text-fg">2</span> for detail,{" "}
          <span className="font-semibold text-fg">status</span> for what is
          running.
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
      </div>
    );
  }

  const bot = state.botUsername;

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.07] p-5">
      <p className="flex items-center gap-2 font-bold text-fg-strong">
        <MessageCircle className="size-4 text-accent" aria-hidden />
        Connect Telegram
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        This is where the head agent reports. Without it the squads still run,
        but nobody tells you what they found.
      </p>

      {state.code ? (
        <div className="mt-4 space-y-3">
          <ol className="space-y-1.5 text-sm text-muted">
            <li>
              1. Open{" "}
              {bot ? (
                <a
                  href={`https://t.me/${bot.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent hover:underline"
                >
                  @{bot.replace(/^@/, "")}
                </a>
              ) : (
                <span className="font-semibold text-fg">our Telegram bot</span>
              )}{" "}
              and press Start.
            </li>
            <li>2. Send it this code:</li>
          </ol>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-fg-strong">
              {state.code}
            </code>
            <Button
              variant="darkOutline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(state.code ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <p className="text-xs text-faint">
            Valid for 15 minutes, once. Generate another if it expires.
          </p>
        </div>
      ) : (
        <Button onClick={issueCode} disabled={pending} size="sm" className="mt-4">
          {pending ? <Loader2 className="animate-spin" /> : null}
          Get my code
        </Button>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
