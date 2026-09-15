"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { SpeakReplyButton } from "@/components/ui/speak-reply-button";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { RoomLine } from "@/lib/room";

type MentionAgent = { name: string; seed: string; commander?: boolean };

export function RoomThread({
  initial,
  agents,
  initialText = "",
}: {
  initial: RoomLine[];
  agents: MentionAgent[];
  initialText?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState(initialText);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, working]);

  const mentionQuery = useMemo(() => {
    const match = text.match(/(?:^|\s)@([^\s@]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [text]);
  const mentionOptions = useMemo(
    () =>
      mentionQuery === null
        ? []
        : agents
            .filter((agent) => agent.name.toLowerCase().includes(mentionQuery))
            .slice(0, 12),
    [mentionQuery, agents],
  );

  useEffect(() => { setMentionIndex(0); }, [mentionQuery]);

  function insertMention(name: string) {
    setText((value) => value.replace(/@[^\s@]*$/, `@${name} `));
  }

  function mentioned(body: string): string | null {
    const lower = body.toLowerCase();
    for (const agent of [...agents].sort((a, b) => b.name.length - a.name.length)) {
      if (lower.includes(`@${agent.name.toLowerCase()}`)) return agent.name;
    }
    return null;
  }

  async function send() {
    const body = text.trim();
    if (!body || working) return;
    const who = mentioned(body);
    setText(""); setError(null); setWorking(who ?? "Kryx");
    setMessages((prev) => [...prev, { id: `local:${Date.now()}`, agent_id: null, template_id: null, body, mentions: who ? [who] : [], generation_id: null, created_at: new Date().toISOString(), name: null }]);
    try {
      const response = await fetch("/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body }) });
      const payload = (await response.json()) as { messages?: RoomLine[]; error?: string; problem?: string | null };
      if (!response.ok) setError(payload.error ?? "Kryx could not send that yet. Try again.");
      else { if (payload.messages) setMessages(payload.messages); if (payload.problem) setError(payload.problem); }
    } catch { setError("The room is temporarily unavailable. Your workspace is still safe."); }
    finally { setWorking(null); }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-surface/92 shadow-[0_22px_60px_-42px_rgba(17,24,39,.28)] backdrop-blur-xl">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg py-12 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-fg-strong text-bg"><Sparkles className="size-5" /></span>
            <p className="mt-4 text-[15px] font-bold text-fg-strong">Give Kryx the goal.</p>
            <p className="mt-1 text-sm text-muted">Use @name only when you want a specific specialist.</p>
          </div>
        ) : null}
        {messages.map((message) => <Line key={message.id} message={message} />)}
        {working ? <p className="flex items-center gap-2 text-[13px] text-muted"><Loader2 className="size-3.5 animate-spin" />{working} is working…</p> : null}
        <div ref={endRef} />
      </div>

      {error ? <p role="alert" className="border-t border-line bg-[var(--danger-wash)] px-5 py-2.5 text-[13px] text-danger">{error}</p> : null}

      <div className="relative border-t border-line bg-surface/95 p-3 sm:p-4">
        {mentionOptions.length ? (
          <div className="absolute bottom-[86px] left-4 z-20 max-h-64 w-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow)]">
            {mentionOptions.map((agent, index) => (
              <button
                key={agent.name}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(agent.name);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] ${index === mentionIndex ? "bg-surface-2 text-fg-strong" : "text-muted"}`}
              >
                <AgentAvatar
                  name={agent.name}
                  seed={agent.seed}
                  size={26}
                  commander={agent.commander}
                />
                <span className="font-semibold">@{agent.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-line bg-bg/70 p-2 shadow-sm focus-within:border-line-strong">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
            if (mentionOptions.length && e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionOptions.length - 1)); return; }
            if (mentionOptions.length && e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
            if (mentionOptions.length && (e.key === "Tab" || e.key === "Enter")) { e.preventDefault(); insertMention(mentionOptions[mentionIndex].name); return; }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
          }} rows={2} placeholder="Ask Kryx anything… or type @ for a specialist" aria-label="Message the room" className="min-h-[50px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-fg placeholder:text-faint focus:outline-none" />
          <button type="button" onClick={() => void send()} disabled={!text.trim() || Boolean(working)} className="grid size-11 shrink-0 place-items-center rounded-xl bg-fg-strong text-bg transition hover:scale-[1.02] disabled:opacity-40"><Send className="size-4" /></button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-faint">No @ = Kryx handles it. @name = that specialist owns it.</p>
      </div>
    </div>
  );
}

function Line({ message }: { message: RoomLine }) {
  const isFounder = !message.template_id;
  return (
    <div className="flex gap-3">
      {isFounder ? <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-3 text-[11px] font-bold text-fg">You</span> : <AgentAvatar
          name={message.name ?? "Agent"}
          seed={message.template_id!}
          size={30}
          commander={message.template_id === "head-agent"}
        />}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2"><span className="text-[13px] font-bold text-fg-strong">{isFounder ? "You" : message.name}</span><time dateTime={message.created_at} className="text-[11px] text-faint">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p>
        <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-fg">{message.body}</p>
        {!isFounder ? <SpeakReplyButton text={message.body} /> : null}
      </div>
    </div>
  );
}
