"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { RoomLine } from "@/lib/room";

type LocalLine = RoomLine & { delivery?: "sending" | "uncertain" };
const STARTERS = ["Find 10 leads for my business", "Audit my landing page", "Draft a LinkedIn post", "Research my competitors"];

export function RoomThread({ initial, names, headName = "Seamus" }: { initial: RoomLine[]; names: string[]; headName?: string }) {
  const [messages, setMessages] = useState<LocalLine[]>(initial);
  const [text, setText] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursor, setCursor] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const follow = useRef(true);
  const controller = useRef<AbortController | null>(null);

  function merge(server: RoomLine[]) {
    setMessages(previous => {
      const unmatched = [...server];
      const locals = previous.filter(message => {
        if (!message.id.startsWith("local:")) return false;
        const match = unmatched.findIndex(row => !row.template_id && row.body === message.body &&
          Math.abs(Date.parse(row.created_at) - Date.parse(message.created_at)) < 300_000);
        if (match < 0) return true;
        unmatched.splice(match, 1);
        return false;
      });
      const saved = new Map(previous.filter(m => !m.id.startsWith("local:")).map(m => [m.id, m]));
      for (const row of server) saved.set(row.id, row);
      const next = [...saved.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).slice(-100).concat(locals);
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
  }

  useEffect(() => {
    let live = true;
    let active = false;
    const abort = new AbortController();
    async function poll() {
      if (active || document.hidden) return;
      active = true;
      try {
        const response = await fetch("/api/room", { cache: "no-store", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]) });
        if (!response.ok) throw new Error("History unavailable");
        const data = await response.json();
        if (live && Array.isArray(data.messages)) { merge(data.messages); setSyncError(false); }
      } catch { if (live) setSyncError(true); }
      finally { active = false; }
    }
    void poll();
    const timer = setInterval(poll, 5000);
    document.addEventListener("visibilitychange", poll);
    return () => { live = false; clearInterval(timer); abort.abort(); document.removeEventListener("visibilitychange", poll); controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if (follow.current) endRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [messages, working]);

  const mentionQuery = useMemo(() => /(?:^|\s)@([^@\n]*)$/.exec(text.slice(0, cursor))?.[1].toLowerCase() ?? null, [text, cursor]);
  const mentionOptions = useMemo(() => mentionQuery === null ? [] : names.filter(name => name.toLowerCase().startsWith(mentionQuery)).slice(0, 6), [mentionQuery, names]);
  function insertMention(name: string) {
    const start = text.lastIndexOf("@", cursor - 1);
    const position = start + name.length + 2;
    setText(text.slice(0, start) + `@${name} ` + text.slice(cursor));
    setCursor(position); setMentionIndex(0);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(position, position); });
  }

  async function send() {
    const body = text.trim();
    if (!body || sending.current) return;
    sending.current = true;
    const who = [...names].sort((a, b) => b.length - a.length).find(name => {
      const index = body.toLowerCase().indexOf(`@${name.toLowerCase()}`);
      return index >= 0 && !/[a-z0-9]/i.test(body[index + name.length + 1] ?? "");
    });
    const id = `local:${crypto.randomUUID()}`;
    follow.current = true;
    setText(""); setCursor(0); setError(null); setWorking(who ?? headName);
    setMessages(previous => [...previous, { id, agent_id: null, template_id: null, body, mentions: who ? [who] : [], generation_id: null, created_at: new Date().toISOString(), name: null, delivery: "sending" }]);
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body }), signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(290_000)]) });
      const payload = await response.json() as { messages?: RoomLine[]; error?: string; problem?: string | null };
      if (payload.messages) {
        // The completed server snapshot is authoritative for this request.
        setMessages(previous => [...payload.messages!, ...previous.filter(m => m.id.startsWith("local:") && m.id !== id)]);
      }
      if (!response.ok || payload.problem) {
        if ([400, 401, 402, 403, 429].includes(response.status) || (payload.messages && !payload.messages.some(m => !m.template_id && m.body === body))) {
          setMessages(previous => previous.filter(m => m.id !== id));
          setText(previous => previous || body);
        }
        throw new Error(payload.error || payload.problem || "The request could not finish.");
      }
    } catch (cause) {
      setMessages(previous => previous.map(m => m.id === id ? { ...m, delivery: "uncertain" } : m));
      setError(cause instanceof Error && !["AbortError", "TimeoutError"].includes(cause.name)
        ? cause.message : "Connection interrupted. Check the conversation and agent output before sending again.");
    } finally { sending.current = false; setWorking(null); controller.current = null; }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-surface">
      <div ref={scrollRef} role="log" aria-label="Team conversation" aria-live="polite" onScroll={() => {
        const el = scrollRef.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      }} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {!messages.length && <div className="py-6"><p className="text-lg font-semibold text-fg-strong">What should we work on?</p><p className="mt-1 text-sm text-muted">Tell {headName} the outcome. Your team will take it from there.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{STARTERS.map(prompt => <button key={prompt} type="button" onClick={() => { setText(prompt); setCursor(prompt.length); inputRef.current?.focus(); }} className="min-h-11 rounded-lg border border-line px-3 py-3 text-left text-sm text-fg hover:bg-surface-2 active:scale-[.99]">{prompt}</button>)}</div></div>}
        {messages.map(message => <Line key={message.id} message={message} />)}
        {working && <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" />{working} is working. Updates appear here.</p>}
        <div ref={endRef} />
      </div>
      {syncError && <p role="status" className="px-4 py-2 text-xs text-muted">Reconnecting to room updates… Your current conversation is kept here.</p>}
      {error && <p role="alert" className="border-t border-line px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="relative border-t border-line p-3">
        {!!mentionOptions.length && <div role="listbox" aria-label="Choose an agent" className="absolute bottom-full left-3 right-3 z-20 mb-2 max-h-48 overflow-auto rounded-xl border border-line bg-surface shadow-lg">{mentionOptions.map((name, index) => <button key={name} role="option" aria-selected={index === mentionIndex % mentionOptions.length} type="button" onClick={() => insertMention(name)} className={`flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${index === mentionIndex % mentionOptions.length ? "bg-surface-2 text-fg-strong" : "text-muted"}`}><AgentAvatar name={name} seed={name} size={24} />@{name}</button>)}</div>}
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={text} maxLength={1000} onChange={e => { setText(e.target.value); setCursor(e.target.selectionStart); setMentionIndex(0); }} onSelect={e => setCursor(e.currentTarget.selectionStart)} onKeyDown={e => {
            if (e.nativeEvent.isComposing) return;
            if (mentionOptions.length && ["ArrowDown", "ArrowUp", "Tab", "Enter"].includes(e.key) && !e.shiftKey) {
              e.preventDefault();
              if (e.key === "ArrowDown") setMentionIndex(i => (i + 1) % mentionOptions.length);
              else if (e.key === "ArrowUp") setMentionIndex(i => (i - 1 + mentionOptions.length) % mentionOptions.length);
              else insertMention(mentionOptions[mentionIndex % mentionOptions.length]);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }} rows={2} placeholder={`Ask ${headName}… or type @ to choose an agent`} aria-label="Message the room" className="min-h-[52px] min-w-0 flex-1 resize-none rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-fg placeholder:text-faint focus:border-accent-line focus:outline-none" />
          <button type="button" onClick={() => void send()} disabled={!text.trim() || !!working} className="inline-flex h-[52px] items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg active:scale-95 disabled:opacity-50"><Send className="size-4" />Send</button>
        </div>
        <p className="mt-2 text-xs text-faint">@name picks a specialist. Enter sends · Shift+Enter adds a line.</p>
      </div>
    </div>
  );
}

function Line({ message }: { message: LocalLine }) {
  const founder = !message.template_id;
  return <div className="flex gap-3">{founder ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-fg">You</span> : <AgentAvatar name={message.name ?? "Agent"} seed={message.template_id!} size={32} />}<div className="min-w-0 flex-1"><p className="flex flex-wrap items-baseline gap-2"><span className="text-sm font-bold text-fg-strong">{founder ? "You" : message.name}</span><time dateTime={message.created_at} className="text-xs text-faint">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p><p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">{message.body}</p>{message.delivery && <p className="mt-1 text-xs text-muted">{message.delivery === "sending" ? "Sending…" : "Delivery unconfirmed — check saved messages before retrying."}</p>}{message.agent_id && <Link href={message.generation_id ? `/dashboard/outputs/${message.generation_id}` : `/dashboard/agents/${message.agent_id}/chat`} className="mt-1 inline-block py-2 text-sm text-accent underline">{message.generation_id ? "Open full output" : "Continue in agent chat"}</Link>}</div></div>;
}
