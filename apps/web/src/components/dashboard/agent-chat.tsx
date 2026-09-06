"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/supabase/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

/**
 * Talking to an agent in the shared runtime.
 *
 * The browser never touches the agent's URL or its token: this posts to
 * AgentStack, which forwards the turn to the deployment and persists both
 * sides. That keeps the bearer token server-side and the transcript durable.
 */
export function AgentChat({
  agentId,
  paused,
  history,
  suggestions,
}: {
  agentId: string;
  paused: boolean;
  history: ChatMessage[];
  suggestions: string[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    history.map((message) => ({ role: message.role, content: message.content })),
  );
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setDraft("");
    setError(null);
    setPending(true);
    setTurns((current) => [
      ...current,
      { role: "user", content: message },
      { role: "assistant", content: "", pending: true },
    ]);

    try {
      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) throw new Error(payload.error ?? "The agent did not answer.");

      setTurns((current) => [
        ...current.slice(0, -1),
        { role: "assistant", content: payload.reply ?? "" },
      ]);
    } catch (cause) {
      setTurns((current) => current.slice(0, -1));
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {paused ? (
          <p className="rounded-lg border border-[var(--money-line)] bg-[var(--money-wash)] px-4 py-3 text-sm text-money">
            This agent is stopped. Start it from the agent list before chatting.
          </p>
        ) : null}

        {turns.length === 0 ? (
          <div className="space-y-3 py-6">
            <p className="text-sm text-muted">Try one of these:</p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="block w-full rounded-lg border border-line p-3.5 text-left text-[15px] text-muted transition-colors hover:border-line-strong hover:text-fg-strong"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              turn.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "group max-w-[85%] rounded-2xl px-4 py-3",
                turn.role === "user"
                  ? "bg-accent text-accent-fg"
                  : "border border-line bg-surface-2 text-fg",
              )}
            >
              {turn.pending ? (
                <span className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </span>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {turn.content}
                  </p>
                  {turn.role === "assistant" ? (
                    <div className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton value={turn.content} />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
        className="mt-4 flex shrink-0 items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          placeholder="Ask the agent to do something…"
          aria-label="Message"
          className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <Button
          type="submit"
          disabled={pending || !draft.trim()}
          size="icon"
          className="size-12"
          aria-label="Send"
        >
          {pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
        </Button>
      </form>
    </>
  );
}
