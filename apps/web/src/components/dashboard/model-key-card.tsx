"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * The one key every agent runs on, changeable in one place.
 *
 * The founder brings their own model key, and it is shared across all fourteen
 * agents. When it rotates — a leaked key revoked, a free OpenRouter key traded
 * for a paid one, a move from OpenAI to Groq — the alternative to this card is
 * opening fourteen agent pages, and nobody does that. So it is one field that
 * re-keys the whole army.
 *
 * It never shows the stored key back — a key you can read off a screen is a key
 * that leaks over someone's shoulder. All it reports is whether one is on file.
 */
export function ModelKeyCard({ configured }: { configured: boolean }) {
  const [saved, setSaved] = useState(configured);
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/settings/model-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save that key.");
      setSaved(true);
      setKey("");
      setDone(payload.message ?? "Saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-5">
      <p className="flex items-center gap-2 font-bold text-fg-strong">
        <KeyRound className="size-4 text-accent" aria-hidden />
        Model API key
        {saved ? (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--live-wash)] px-2 py-0.5 text-[11px] font-bold text-live">
            <Check className="size-3" /> on file
          </span>
        ) : null}
      </p>

      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        One key, shared by every agent — you pay the provider directly and we
        never see the bill. Works with any OpenAI-compatible endpoint:
        OpenRouter, OpenAI, Groq, Together, NVIDIA NIM.
        {saved ? " Paste a new one to replace it everywhere." : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder={saved ? "Paste a new key to replace it" : "sk-or-v1-…"}
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="min-w-[16rem] flex-1"
        />
        <Button onClick={save} disabled={pending || key.trim().length < 10} size="md">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {saved ? "Replace key" : "Save key"}
        </Button>
      </div>

      {done ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-live">
          <Check className="size-4" aria-hidden />
          {done}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-faint">
        Encrypted before it is stored, decrypted only at deploy. Changing it here
        updates every agent; redeploy them to pick it up.
      </p>
    </div>
  );
}
