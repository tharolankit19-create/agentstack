"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { RoomLine } from "@/lib/room";
import Link from "next/link";
import { usePaywall } from "./paywall";

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState(0);
  const paywall = usePaywall();
  const mentionToken = /(?:^|\s)@([^@\n]*)$/.exec(text.slice(0, cursor));
  const choices = mentionToken ? names.filter(name => name.toLowerCase().startsWith(mentionToken[1].toLowerCase())) : [];
  function choose(name: string) {
    const start = text.lastIndexOf("@", cursor - 1);
    const next = text.slice(0, start) + `@${name} ` + text.slice(cursor);
    setText(next); setCursor(start + name.length + 2); setSelected(0);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + name.length + 2, start + name.length + 2); });
  }
  useEffect(() => {
    let live = true;
    let active = false;
    async function poll() {
      if (active || document.hidden) return;
      active = true;
      try {
        const response = await fetch("/api/room", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (live && data.messages) setMessages(prev => {
          const server = data.messages as RoomLine[];
          const unsaved = prev.filter(m => m.id.startsWith("local:") && !server.some(s => !s.template_id && s.body === m.body && Math.abs(Date.parse(s.created_at) - Date.parse(m.created_at)) < 60_000));
          return [...server, ...unsaved];
        });
      } catch { /* Keep the last saved view during network failures. */ }
      finally { active = false; }
    }
    const timer = setInterval(poll, 3000);
    return () => { live = false; clearInterval(timer); };
  }, []);

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
    if (!paywall.isPaid) { paywall.open("Start your 3-day trial to talk to the team"); return; }

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
        if (response.status === 402) paywall.open("Start your 3-day trial to keep working");
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
        {choices.length > 0 && <div role="listbox" aria-label="Mention an agent" className="mb-2 max-h-48 overflow-auto rounded-lg border border-line bg-surface-2 p-1">
          {choices.map((name, index) => <button key={name} role="option" aria-selected={index === selected} type="button" onClick={() => choose(name)} className={`block w-full rounded px-3 py-2 text-left text-sm ${index === selected ? "bg-accent text-accent-fg" : "text-fg"}`}>@{name}</button>)}
        </div>}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); setCursor(e.target.selectionStart); setSelected(0); }}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (choices.length && ["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) {
                e.preventDefault();
                if (e.key === "ArrowDown") setSelected(i => (i + 1) % choices.length);
                else if (e.key === "ArrowUp") setSelected(i => (i - 1 + choices.length) % choices.length);
                else choose(choices[selected % choices.length]);
                return;
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
      {isFounder ? (
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold text-fg"
          aria-hidden
        >
          You
        </span>
      ) : (
        <AgentAvatar name={message.name ?? "Agent"} seed={message.template_id!} size={32} />
      )}

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
        {message.agent_id && <Link className="mt-1 inline-block text-sm text-accent underline" href={message.generation_id ? `/dashboard/outputs/${message.generation_id}` : `/dashboard/agents/${message.agent_id}/chat#work-progress`}>{message.generation_id ? "Open deliverable" : "Open agent chat"}</Link>}
      </div>
    </div>
  );
}
