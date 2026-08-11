"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The install step nobody knew existed.
 *
 * Setting `TELEGRAM_BOT_TOKEN` creates a bot that can send messages and cannot
 * receive them: Telegram holds every incoming update until somebody tells it
 * where to deliver them. Until that call is made the bot is silent, and from
 * the outside a silent bot is indistinguishable from a wrong token, a broken
 * webhook route, or a bug in the reply logic.
 *
 * So this is a button that makes the call, and — more useful on a bad day — a
 * panel that says which of those four things is actually wrong.
 *
 * Owner-only. It decides where every customer's messages get delivered.
 */

interface Diagnosis {
  ok: boolean;
  bot: { username: string; name: string } | null;
  hasToken: boolean;
  hasSecret: boolean;
  expectedWebhook: string | null;
  registeredWebhook: string | null;
  pendingUpdates: number | null;
  lastError: string | null;
  problems: string[];
}

export function TelegramSetup() {
  const [state, setState] = useState<Diagnosis | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setError(null);
    try {
      const response = await fetch("/api/telegram/setup");
      if (!response.ok) throw new Error("Could not read the bot's status.");
      setState((await response.json()) as Diagnosis);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    void check();
  }, []);

  async function register() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/telegram/setup", { method: "POST" });
      const payload = (await response.json()) as Diagnosis & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Telegram refused it.");
      setState(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface-2 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <MessageCircle className="size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-fg-strong">The bot</h2>
          <p className="text-sm text-muted">
            {state?.bot
              ? `@${state.bot.username}`
              : "Not identified — check the token."}
          </p>
        </div>

        <Button onClick={register} disabled={pending} size="sm">
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {state?.registeredWebhook ? "Re-register webhook" : "Register webhook"}
        </Button>
      </div>

      {state ? (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-1.5 border-t border-line pt-4 text-sm sm:grid-cols-2">
            <Line label="Bot token" ok={state.hasToken} />
            <Line label="Webhook secret" ok={state.hasSecret} />
            <Line
              label="Webhook registered"
              ok={Boolean(state.registeredWebhook)}
            />
            <Line
              label="Points at us"
              ok={state.registeredWebhook === state.expectedWebhook}
            />
          </dl>

          {state.registeredWebhook ? (
            <p className="mt-3 break-all text-xs text-faint">
              → {state.registeredWebhook}
              {state.pendingUpdates ? ` · ${state.pendingUpdates} pending` : ""}
            </p>
          ) : null}

          {state.problems.length > 0 ? (
            <ul className="mt-4 space-y-1.5 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] p-3 text-sm text-danger">
              {state.problems.map((problem) => (
                <li key={problem} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {problem}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-live">
              <Check className="size-4" aria-hidden />
              Working. Customers can connect and it will answer them.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Asking Telegram…
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Line({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={ok ? "font-semibold text-live" : "font-semibold text-danger"}>
        {ok ? "yes" : "no"}
      </dd>
    </div>
  );
}
