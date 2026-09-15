"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient, SupabaseNotConfiguredError } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (!STRONG.test(password)) {
      setError("Use 12+ characters with uppercase, lowercase, a number and a symbol.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => window.location.assign("/dashboard"), 800);
    } catch (cause) {
      if (cause instanceof SupabaseNotConfiguredError) setError(cause.message);
      else setError(cause instanceof Error ? cause.message : "Could not update the password.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-fg">
        Password updated. Opening your workspace…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="password"
        required
        minLength={12}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        aria-label="New password"
      />
      <Input
        type="password"
        required
        minLength={12}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        placeholder="Confirm new password"
        autoComplete="new-password"
        aria-label="Confirm new password"
      />
      <Button type="submit" disabled={pending} size="md" className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Updating…" : "Update password"}
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </form>
  );
}
