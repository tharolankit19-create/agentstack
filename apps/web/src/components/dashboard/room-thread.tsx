"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { initialsFor } from "@/lib/ref";
import type { RoomLine } from "@/lib/room";

/**
 * The thread.
 *
 * The founder's message and the agent's answer are separated by however long
 * the agent takes to actually do the job — which can be thirty seconds. So the
 * founder's line is added optimistically and a working state names who is
 * working, because a spinner with no name reads as the page being stuck rather
 * than as Wren auditing a page.
 */
export function RoomThread({ initial, names }: { initial: RoomLine[]; names: string[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, working]);

  /** Who the founder just addressed, so the waiting state can name them. */
  function mentioned(body: string): string | null {
    const lower = body.toLowerCase();
    // Longest first: "@Ada" would otherwise win over "@Ada Lovelace".
    for (const name of [...names].sort((a, b) => b.length - a.length)) {
      if (lower.includes(`@${name.toLowerCase()}`)) return name;
    }
    return null;
  }

  async function send() {
    const body = text.trim();
    if (!body || working) return;

    const who = mentioned(body);
    setText("");
    setError(null);
    setWorking(who ?? "the team");

    // Shown immediately. The round trip can take as long as a real run, and a
    // founder watching their own words vanish assumes the send failed.
    setMessages((prev) => [
      ...prev,
      {
        id: `local:${Date.now()}`,
        agent_id: null,
        template_id: null,
        body,
        mentions: who ? [who] : [],
        generation_id: null,
        created_at: new Date().toISOString(),
        name: null,
      },
    ]);

    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const payload = (await response.json()) as {
        messages?: RoomLine[];
        error?: string;
        problem?: string | null;
      };

      if (!response.ok) {
        setError(payload.error ?? "That did not go through.");
      } else {
        if (payload.messages) setMessages(payload.messages);
        if (payload.problem) setError(payload.problem);
      }
    } catch {
      setError("Could not reach the room.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-surface">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-muted">
            Quiet so far. Your agents post here when they have done something
            worth another one knowing.
          </p>
        ) : null}

        {messages.map((message) => (
          <Line key={message.id} message={message} />
        ))}

        {working ? (
          <p className="flex items-center gap-2 text-[14px] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            {working === "the team" ? "Passing it on…" : `${working} is on it…`}
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      {error ? (
        <p role="alert" className="border-t border-line px-5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, shift+enter is a newline — the convention every
              // chat uses, and getting it wrong is felt on the first message.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="@Wren why hasn't the audit happened?"
            aria-label="Message the room"
            className="min-h-[52px] flex-1 resize-y rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-fg placeholder:text-faint focus:border-accent-line focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim() || Boolean(working)}
            className="inline-flex h-[52px] items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-fg disabled:opacity-50"
          >
            <Send className="size-4" />
            Send
          </button>
        </div>

        <p className="mt-2 px-1 text-[12.5px] text-faint">
          Naming someone puts them on the job for real — they run, then report
          back here.
        </p>
      </div>
    </div>
  );
}

function Line({ message }: { message: RoomLine }) {
  const isFounder = !message.template_id;

  return (
    <div className="flex gap-3">
      {/* Square initials, not a generated round avatar. Twelve coloured circles
          carry no information and are the house style of every AI-built
          dashboard; the tile matches the ledger's rail, so the room and the
          board are visibly the same product. */}
      <span
        className="grid size-8 shrink-0 place-items-center border border-line-strong bg-surface-2 font-mono text-[11px] font-semibold uppercase text-muted"
        aria-hidden
      >
        {isFounder ? "YOU" : initialsFor(message.name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-[14px] font-bold text-fg-strong">
            {isFounder ? "You" : message.name}
          </span>
          <time dateTime={message.created_at} className="text-[12px] text-faint">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </p>

        <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-fg">
          {message.body}
        </p>
      </div>
    </div>
  );
}
