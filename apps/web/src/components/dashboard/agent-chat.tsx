"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, SendHorizonal, Square } from "lucide-react";
import { SpeakReplyButton } from "@/components/ui/speak-reply-button";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/supabase/types";

interface Turn { role: "user" | "assistant"; content: string; pending?: boolean; }

export function AgentChat({ agentId, paused, history, suggestions }: { agentId: string; paused: boolean; history: ChatMessage[]; suggestions: string[] }) {
  const [turns, setTurns] = useState<Turn[]>(() => history.map((message) => ({ role: message.role, content: message.content })));
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending || paused) return;
    setDraft(""); setError(null); setPending(true);
    setTurns((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "", pending: true }]);
    try {
      const response = await fetch(`/api/agents/${agentId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The agent did not answer.");
      setTurns((current) => [...current.slice(0, -1), { role: "assistant", content: payload.reply ?? "" }]);
    } catch (cause) {
      setTurns((current) => current.slice(0, -1));
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally { setPending(false); }
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const form = new FormData();
          form.set("audio", blob, "voice.webm");
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const payload = (await response.json()) as { text?: string; error?: string };
          if (!response.ok || !payload.text) throw new Error(payload.error ?? "Couldn't understand that voice note.");
          await send(payload.text);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't understand that voice note."); }
        finally { setTranscribing(false); }
      };
      recorder.start();
      setRecording(true);
    } catch { setError("Microphone permission is needed for voice notes."); }
  }

  return <>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      {paused ? <p className="rounded-lg border border-[var(--money-line)] bg-[var(--money-wash)] px-4 py-3 text-sm text-money">This agent is stopped. Start it from the agent list before chatting.</p> : null}
      {turns.length === 0 ? <div className="space-y-3 py-6"><p className="text-sm text-muted">Try one of these:</p>{suggestions.slice(0, 4).map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="block w-full rounded-lg border border-line p-3.5 text-left text-[15px] text-muted transition-colors hover:border-line-strong hover:text-fg-strong">{suggestion}</button>)}</div> : null}
      {turns.map((turn, index) => <div key={index} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}><div className={cn("group max-w-[85%] rounded-2xl px-4 py-3", turn.role === "user" ? "bg-accent text-accent-fg" : "border border-line bg-surface-2 text-fg")}>{turn.pending ? <span className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" />Working…</span> : <><p className="whitespace-pre-wrap text-[15px] leading-relaxed">{turn.content}</p>{turn.role === "assistant" ? <div className="mt-2 flex items-center gap-1"><CopyButton value={turn.content} /><SpeakReplyButton text={turn.content} /></div> : null}</>}</div></div>)}
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}<div ref={bottomRef} />
    </div>
    <form onSubmit={(event) => { event.preventDefault(); void send(draft); }} className="mt-4 flex shrink-0 items-end gap-2">
      <button type="button" onClick={() => void toggleRecording()} disabled={paused || pending || transcribing} className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted", recording && "border-danger text-danger")} aria-label={recording ? "Stop recording" : "Send voice note"}>{transcribing ? <Loader2 className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4" />}</button>
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }} rows={1} placeholder={recording ? "Listening… tap stop when done" : "Message or send a voice note…"} aria-label="Message" className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent focus:outline-none" />
      <Button type="submit" disabled={paused || pending || !draft.trim()} size="icon" className="size-12" aria-label="Send">{pending ? <Loader2 className="animate-spin" /> : <SendHorizonal />}</Button>
    </form>
  </>;
}
