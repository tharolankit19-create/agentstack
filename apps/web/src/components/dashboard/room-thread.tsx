"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { RoomLine } from "@/lib/room";

export function RoomThread({ initial, names }: { initial: RoomLine[]; names: string[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, working]);

  const mentionQuery = useMemo(() => {
    const match = text.match(/(?:^|\s)@([^\s@]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [text]);
  const mentionOptions = useMemo(() => mentionQuery === null ? [] : names.filter((name) => name.toLowerCase().includes(mentionQuery)).slice(0, 6), [mentionQuery, names]);

  useEffect(() => { setMentionIndex(0); }, [mentionQuery]);

  function insertMention(name: string) {
    setText((value) => value.replace(/@[^\s@]*$/, `@${name} `));
  }

  function mentioned(body: string): string | null {
    const lower = body.toLowerCase();
    for (const name of [...names].sort((a, b) => b.length - a.length)) {
      if (lower.includes(`@${name.toLowerCase()}`)) return name;
    }
    return null;
  }

  async function send() {
    const body = text.trim();
    if (!body || working) return;
    const who = mentioned(body);
    setText(""); setError(null); setWorking(who ?? "Seamus");
    setMessages((prev) => [...prev, { id: `local:${Date.now()}`, agent_id: null, template_id: null, body, mentions: who ? [who] : [], generation_id: null, created_at: new Date().toISOString(), name: null }]);
    try {
      const response = await fetch("/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body }) });
      const payload = (await response.json()) as { messages?: RoomLine[]; error?: string; problem?: string | null };
      if (!response.ok) setError(payload.error ?? "That did not go through.");
      else { if (payload.messages) setMessages(payload.messages); if (payload.problem) setError(payload.problem); }
    } catch { setError("Could not reach the room."); }
    finally { setWorking(null); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-surface">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 ? <p className="py-10 text-center text-[15px] text-muted">Quiet so far. Ask Seamus, or type @ to hand a job to a specialist.</p> : null}
        {messages.map((message) => <Line key={message.id} message={message} />)}
        {working ? <p className="flex items-center gap-2 text-[14px] text-muted"><Loader2 className="size-3.5 animate-spin" />{working} is on it…</p> : null}
        <div ref={endRef} />
      </div>
      {error ? <p role="alert" className="border-t border-line px-5 py-2.5 text-[13.5px] text-danger">{error}</p> : null}
      <div className="relative border-t border-line p-3">
        {mentionOptions.length ? (
          <div className="absolute bottom-[76px] left-3 z-20 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]">
            {mentionOptions.map((name, index) => (
              <button key={name} type="button" onMouseDown={(e) => { e.preventDefault(); insertMention(name); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] ${index === mentionIndex ? "bg-surface-2 text-fg-strong" : "text-muted"}`}>
                <AgentAvatar name={name} seed={name} size={24} /><span className="font-semibold">@{name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
            if (mentionOptions.length && e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionOptions.length - 1)); return; }
            if (mentionOptions.length && e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
            if (mentionOptions.length && (e.key === "Tab" || e.key === "Enter")) { e.preventDefault(); insertMention(mentionOptions[mentionIndex]); return; }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }} rows={2} placeholder="Ask Seamus… or type @ to choose an agent" aria-label="Message the room" className="min-h-[52px] flex-1 resize-y rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] text-fg placeholder:text-faint focus:border-accent-line focus:outline-none" />
          <button type="button" onClick={() => void send()} disabled={!text.trim() || Boolean(working)} className="inline-flex h-[52px] items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-semibold text-accent-fg disabled:opacity-50"><Send className="size-4" />Send</button>
        </div>
        <p className="mt-2 px-1 text-[12.5px] text-faint">No @ = Seamus coordinates it. @name = that specialist owns the job.</p>
      </div>
    </div>
  );
}

function Line({ message }: { message: RoomLine }) {
  const isFounder = !message.template_id;
  return <div className="flex gap-3">{isFounder ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold text-fg">You</span> : <AgentAvatar name={message.name ?? "Agent"} seed={message.template_id!} size={32} />}<div className="min-w-0 flex-1"><p className="flex items-baseline gap-2"><span className="text-[14px] font-bold text-fg-strong">{isFounder ? "You" : message.name}</span><time dateTime={message.created_at} className="text-[12px] text-faint">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p><p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-fg">{message.body}</p></div></div>;
}
