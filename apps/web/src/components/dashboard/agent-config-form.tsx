"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { isPlatformSecret } from "@/lib/platform-secrets";
import type { AgentTemplate } from "@/lib/templates";
import type { Agent } from "@/lib/supabase/types";
import { usePaywall } from "./paywall";

/**
 * The whole setup, on one screen.
 *
 * Settings and API keys are submitted together. Keys already saved are shown
 * as "saved" and never sent back to the browser — leaving the field blank
 * keeps the stored key, typing in it replaces the key.
 */
export function AgentConfigForm({
  agent,
  template,
}: {
  agent: Agent;
  template: AgentTemplate;
}) {
  const router = useRouter();
  const paywall = usePaywall();
  const isCustomAgent = Boolean(agent.custom_agent_id);
  const externalSecrets = template.secrets.filter(
    (spec) => !isPlatformSecret(spec.key),
  );
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const spec of template.settings) {
      initial[spec.key] = agent.config?.[spec.key] ?? spec.default ?? "";
    }
    return initial;
  });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [name, setName] = useState(agent.name);
  const [pending, setPending] = useState<"save" | "deploy" | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  async function save(thenDeploy: boolean) {
    if (thenDeploy && !paywall.isPaid) { paywall.open("Start your 3-day trial to activate this agent"); return; }
    setPending(thenDeploy ? "deploy" : "save");
    setErrors([]);
    setSaved(false);

    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, config, secrets }),
      });
      const payload = (await response.json()) as {
        error?: string;
        errors?: string[];
      };

      if (!response.ok) {
        setErrors(payload.errors ?? [payload.error ?? "Could not save that."]);
        setPending(null);
        return;
      }

      // Keys are stored now; drop the plaintext from React state immediately.
      setSecrets({});
      setSaved(true);

      if (thenDeploy) {
        const deployResponse = await fetch(`/api/agents/${agent.id}/deploy`, {
          method: "POST",
        });
        const deployPayload = (await deployResponse.json()) as { error?: string };
        if (!deployResponse.ok) {
          setErrors([
            deployPayload.error ??
              (isCustomAgent ? "Deploy failed." : "Activation failed."),
          ]);
          setPending(null);
          return;
        }
        router.push(isCustomAgent ? "/dashboard/deploy" : "/dashboard");
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      setErrors(["Network error. Try again."]);
    } finally {
      setPending(null);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
      className="space-y-8"
    >
      <section className="space-y-5">
        <Field label="Agent name" htmlFor="agent-name">
          <Input
            id="agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
          />
        </Field>

        {template.settings.map((spec) => {
          const id = `setting-${spec.key}`;
          const value = config[spec.key] ?? "";
          const update = (next: string) =>
            setConfig((current) => ({ ...current, [spec.key]: next }));

          return (
            <Field
              key={spec.key}
              label={spec.label}
              help={spec.help}
              required={spec.required}
              htmlFor={id}
            >
              {spec.type === "textarea" ? (
                <Textarea
                  id={id}
                  value={value}
                  placeholder={spec.placeholder}
                  onChange={(event) => update(event.target.value)}
                />
              ) : spec.type === "select" ? (
                <Select
                  id={id}
                  value={value}
                  onChange={(event) => update(event.target.value)}
                >
                  {(spec.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  type={spec.type === "url" ? "url" : "text"}
                  value={value}
                  placeholder={spec.placeholder}
                  onChange={(event) => update(event.target.value)}
                />
              )}
            </Field>
          );
        })}
      </section>

      {isCustomAgent && externalSecrets.length > 0 ? (
      <section className="space-y-5 rounded-xl border border-line p-5">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-bold text-fg-strong">API keys</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Encrypted before they are stored, and written straight into your
              agent&apos;s own environment when it deploys. They are never shown
              again, never logged, and never sent to the model.
            </p>
          </div>
        </div>

        {/* Platform-supplied keys are filtered out rather than shown disabled.
            A field asking for a value the deploy pipeline is going to overwrite
            teaches people their answers do not matter. */}
        {externalSecrets.map((spec) => {
          const id = `secret-${spec.key}`;
          const alreadySaved = agent.secret_keys?.includes(spec.key);

          return (
            <Field
              key={spec.key}
              label={spec.label}
              help={
                alreadySaved ? (
                  <span className="text-live">
                    Saved. Leave blank to keep it, or paste a new one to replace it.
                  </span>
                ) : (
                  spec.help
                )
              }
              required={spec.required && !alreadySaved}
              htmlFor={id}
            >
              <Input
                id={id}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={secrets[spec.key] ?? ""}
                placeholder={alreadySaved ? "••••••••••••" : "Paste your key"}
                onChange={(event) =>
                  setSecrets((current) => ({
                    ...current,
                    [spec.key]: event.target.value,
                  }))
                }
              />
            </Field>
          );
        })}
      </section>
      ) : null}

      {errors.length > 0 ? (
        <ul
          role="alert"
          className="space-y-1 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] p-4 text-sm text-danger"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="darkOutline" disabled={pending !== null}>
          {pending === "save" ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>

        <Button
          type="button"
          onClick={() => void save(true)}
          disabled={pending !== null}
        >
          {pending === "deploy" ? <Loader2 className="animate-spin" /> : <Rocket />}
          {isCustomAgent
            ? agent.status === "deployed"
              ? "Save and redeploy"
              : "Save and deploy"
            : agent.status === "deployed"
              ? "Save and restart"
              : "Save and activate"}
        </Button>

        {saved && pending === null ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-live">
            <Check className="size-4" />
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
