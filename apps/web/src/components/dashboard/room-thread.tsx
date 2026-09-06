"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // ── the @ picker ────────────────────────────────────────────────────────
  //
  // Typing @ should offer the roster, and typing @s should narrow it to the
  // names starting with s. Without it the founder has to remember every name
  // exactly, and a mention that does not match a name silently does nothing —
  // the message posts and no agent is ever put on the job.
  //
  // `caret` is the index the @ sits at, so the chosen name replaces exactly the
  // fragment being typed and nothing else. Tracking the fragment instead would
  // break the moment someone edits a message that already contains an @.
  const [caret, setCaret] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    if (caret === null) return [];
    const q = query.toLowerCase();
    const starts = names.filter((n) => n.toLowerCase().startsWith(q));

    // One letter means starts-with only. Typing "s" and being offered Otis
    // because it contains an s is noise at exactly the moment the list should
    // be getting shorter. From two letters on, a contains-match is worth
    // having — it is how someone finds "Seamus" by typing "eam".
    if (q.length < 2) return starts.slice(0, 8);

    const rest = names.filter(
      (n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q),
    );
    return [...starts, ...rest].slice(0, 8);
  }, [caret, query, names]);

  const picking = caret !== null && matches.length > 0;

  /** Re-read the @fragment under the cursor after every edit. */
  function syncPicker(value: string, cursor: number) {
    const upto = value.slice(0, cursor);
    // The last @ that begins a word. A name has no spaces, so a space after the
    // @ closes the picker rather than searching for "wren why hasn't".
    const at = upto.lastIndexOf("@");
    if (at === -1 || (at > 0 && !/\s/.test(upto[at - 1]))) {
      setCaret(null);
      return;
    }
    const fragment = upto.slice(at + 1);
    if (/\s/.test(fragment)) {
      setCaret(null);
      return;
    }
    setCaret(at);
    setQuery(fragment);
    setHighlight(0);
  }

  function choose(name: string) {
    if (caret === null) return;
    const before = text.slice(0, caret);
    const after = text.slice(boxRef.current?.selectionStart ?? text.length);
    // No second space when the tail already starts with one — inserting
    // mid-sentence otherwise leaves "can @Wren  take a look".
    const gap = after.startsWith(" ") ? "" : " ";
    const next = `${before}@${name}${gap}${after}`;
    setText(next);
    setCaret(null);
    // Put the cursor after the inserted name rather than at the end, so the
    // founder can keep typing mid-sentence.
    const position = before.length + name.length + 1 + gap.length;
    requestAnimationFrame(() => {
      boxRef.current?.focus();
      boxRef.current?.setSelectionRange(position, position);
    });
  }

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

      <div className="relative border-t border-line p-3">
        {picking ? (
          <ul
            role="listbox"
            aria-label="Agents you can mention"
            className="absolute bottom-full left-3 z-10 mb-1 w-64 overflow-hidden rounded-[var(--r-panel)] border border-line bg-surface shadow-[var(--shadow-lg)]"
          >
            {matches.map((name, index) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  // onMouseDown, not onClick: blur fires first on a click and
                  // would close the list before the choice registered.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(name);
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] ${
                    index === highlight ? "bg-surface-2 text-fg-strong" : "text-fg"
                  }`}
                >
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-[6px] border border-line-strong bg-surface-2 font-mono text-[10px] font-semibold uppercase text-muted"
                    aria-hidden
                  >
                    {initialsFor(name)}
                  </span>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            ref={boxRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              syncPicker(e.target.value, e.target.selectionStart ?? 0);
            }}
            onClick={(e) =>
              syncPicker(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
            }
            onBlur={() => {
              // Late enough for a click on an option to land first.
              window.setTimeout(() => setCaret(null), 120);
            }}
            onKeyDown={(e) => {
              // While the picker is open it owns the arrows, Enter and Tab —
              // otherwise choosing a name from the list would send the message.
              if (picking) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((i) => (i + 1) % matches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((i) => (i - 1 + matches.length) % matches.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  choose(matches[highlight]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setCaret(null);
                  return;
                }
              }

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
