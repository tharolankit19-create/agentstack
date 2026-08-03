"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, SendHorizonal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The floating helper.
 *
 * A founder who is stuck at 11pm does not open a docs site — they either work
 * it out or they churn. This is the third option, and it knows their plan,
 * their agents, and what they said they were struggling with, so it can answer
 * with a specific agent name instead of a link.
 *
 * Deliberately small: one button, one panel, no notification badge, no
 * proactive popup. A support widget that interrupts is a support widget people
 * learn to close.
 */

interface Turn {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

const STARTERS = [
  "Which agent should I start with?",
  "How do I connect my OpenAI key?",
  "What happens if I cancel?",
];

export function SupportWidget({ firstName }: { firstName: string | null }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No answer came back.");

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
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close help" : "Get help"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-5 right-5 z-[90] grid size-14 place-items-center rounded-full shadow-lg transition-all duration-300",
          "motion-safe:hover:scale-105 motion-safe:active:scale-95",
          open
            ? "bg-surface-2 text-muted ring-1 ring-[var(--line)]"
            : "bg-accent text-fg-strong shadow-[0_8px_30px_rgba(139,92,246,0.35)]",
        )}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>

      {open ? (
        <div className="animate-in-up fixed bottom-24 right-5 z-[90] flex max-h-[min(32rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <header className="shrink-0 border-b border-line px-4 py-3">
            <p className="font-bold text-fg-strong">
              {firstName ? `Hey ${firstName} — need a hand?` : "Need a hand?"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Knows your agents, your plan, and the whole library.
            </p>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <div className="space-y-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="block w-full rounded-lg border border-line px-3 py-2.5 text-left text-sm text-muted transition-colors hover:border-line-strong hover:text-fg-strong"
                  >
                    {starter}
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
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    turn.role === "user"
                      ? "bg-accent text-fg-strong"
                      : "border border-line bg-surface-2 text-fg",
                  )}
                >
                  {turn.pending ? (
                    <span className="flex items-center gap-2 text-muted">
                      <Loader2 className="size-3.5 animate-spin" />
                      Thinking…
                    </span>
                  ) : (
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                  )}
                </div>
              </div>
            ))}

            {error ? (
              <p role="alert" className="text-sm text-danger">
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
            className="flex shrink-0 items-center gap-2 border-t border-line p-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask anything…"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-fg-strong transition-opacity disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizonal className="size-4" />
              )}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
