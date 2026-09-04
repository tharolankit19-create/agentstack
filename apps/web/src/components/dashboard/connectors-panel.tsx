"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Plug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * The connectors, as a short stack of cards — one paste each.
 *
 * Low friction is the whole brief: no wizard, no modal, no "are you sure".
 * A connected tool shows a green check and a masked hint of the key; an
 * unconnected one shows a single field and a link to go get the key. Saving is
 * one request and the card updates in place.
 */

interface ConnectorState {
  id: string;
  name: string;
  blurb: string;
  unlocks: string;
  /** Supplied by the platform — already working, nothing for the founder to do. */
  provided?: boolean;
  placeholder: string;
  getUrl: string;
  connected: boolean;
  hint: string | null;
}

export function ConnectorsPanel({
  initial,
  canOperate,
}: {
  initial: ConnectorState[];
  canOperate: boolean;
}) {
  const [connectors, setConnectors] = useState(initial);

  return (
    <div className="space-y-3">
      {connectors.map((connector) => (
        <ConnectorCard
          key={connector.id}
          connector={connector}
          canOperate={canOperate}
          onChange={(next) =>
            setConnectors((current) =>
              current.map((c) => (c.id === next.id ? next : c)),
            )
          }
        />
      ))}

      <p className="px-1 pt-2 text-xs leading-relaxed text-faint">
        Keys are encrypted the moment you save them and never shown back. We use
        them only to run your agents — you pay each provider directly.
      </p>
    </div>
  );
}

function ConnectorCard({
  connector,
  canOperate,
  onChange,
}: {
  connector: ConnectorState;
  canOperate: boolean;
  onChange: (next: ConnectorState) => void;
}) {
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/connectors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: connector.id, key: key.trim() }),
      });
      const payload = (await response.json()) as {
        connectors?: ConnectorState[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not save that.");
      const updated = payload.connectors?.find((c) => c.id === connector.id);
      if (updated) onChange(updated);
      setKey("");
      setEditing(false);
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
      const response = await fetch("/api/connectors", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: connector.id }),
      });
      const payload = (await response.json()) as {
        connectors?: ConnectorState[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove that.");
      const updated = payload.connectors?.find((c) => c.id === connector.id);
      if (updated) onChange(updated);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const showField = !connector.connected || editing;

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            connector.connected
              ? "bg-[var(--live-wash)] text-live"
              : "bg-surface-3 text-faint",
          )}
          aria-hidden
        >
          {connector.connected || connector.provided ? (
            <Check className="size-5" />
          ) : (
            <Plug className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold text-fg-strong">
            {connector.name}
            {connector.connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--live-wash)] px-2 py-0.5 text-[11px] font-bold text-live">
                connected
              </span>
            ) : connector.provided ? (
              /* Already working on our key. Shown as done rather than as a
                 setup step — this page used to greet a new founder with four
                 required-looking API keys, which is how a working product
                 looks broken on the first screen they see. */
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--live-wash)] px-2 py-0.5 text-[11px] font-bold text-live">
                included
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm text-muted">{connector.blurb}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-faint">
            {connector.unlocks}
          </p>
        </div>

        {connector.connected && !editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg bg-surface px-2 py-1 font-mono text-xs text-muted">
              {connector.hint}
            </span>
            {canOperate ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="text-muted hover:text-fg-strong"
                >
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Disconnect ${connector.name}`}
                  title="Disconnect"
                  onClick={disconnect}
                  disabled={pending}
                  className="text-muted hover:text-danger"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {showField ? (
        canOperate ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={connector.placeholder}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="min-w-[14rem] flex-1"
              onKeyDown={(event) => {
                if (event.key === "Enter" && key.trim().length >= 3) save();
              }}
            />
            <Button
              onClick={save}
              disabled={pending || key.trim().length < 3}
              size="md"
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Connect
            </Button>
            {editing ? (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setEditing(false);
                  setKey("");
                }}
                className="text-muted hover:text-fg-strong"
              >
                Cancel
              </Button>
            ) : null}
            <a
              href={connector.getUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Get a key
              <ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <p className="mt-4 text-sm text-faint">
            Start your trial to connect your own tools.
          </p>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
