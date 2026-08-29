"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { formatUsd } from "@/lib/templates";
import { formatRelative } from "@/lib/utils";
import { usePaywall } from "./paywall";
import type { CustomAgent } from "@/lib/supabase/types";

/**
 * The Pro feature, as a form.
 *
 * Building takes twenty to sixty seconds — it reads several pages and makes a
 * long model call — so the wait is narrated rather than hidden behind a
 * spinner. A blank screen for a minute reads as broken.
 */
export function CustomAgentBuilder({
  existing,
  canBuild,
}: {
  existing: CustomAgent[];
  canBuild: boolean;
}) {
  const router = useRouter();
  const paywall = usePaywall();
  const [sourceUrl, setSourceUrl] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !sourceUrl.trim()) return;

    if (!canBuild) {
      paywall.open("Building agents from your own tools is on Pro");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const payload = await paywall.guard(
        () =>
          fetch("/api/custom-agents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sourceUrl: sourceUrl.trim(),
              apiBaseUrl: apiBaseUrl.trim() || undefined,
              apiKey: apiKey.trim() || undefined,
            }),
          }),
        "Building agents from your own tools is on Pro",
      );

      if (!payload) {
        setPending(false);
        return;
      }

      setSourceUrl("");
      setApiBaseUrl("");
      setApiKey("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function setUpAgent(customAgentId: string) {
    try {
      const payload = await paywall.guard<{ id?: string }>(
        () =>
          fetch("/api/agents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ customAgentId }),
          }),
        "Turn this agent on",
      );
      if (payload?.id) router.push(`/dashboard/agents/${payload.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not set that up.");
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={build}
        className="space-y-5 rounded-2xl border border-line bg-surface-2 p-6"
      >
        <Field
          label="The tool you want to replace"
          htmlFor="source-url"
          required
          help="Its homepage is enough. If its docs live somewhere else, link those instead — the better the docs, the sharper the agent."
        >
          <Input
            id="source-url"
            type="url"
            required
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://the-tool-you-pay-for.com"
          />
        </Field>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-fg">
            Connect its API so the agent can actually drive it (optional)
          </summary>

          <div className="mt-4 space-y-4 border-l-2 border-line pl-4">
            <Field
              label="API base URL"
              htmlFor="api-base"
              help="Something like https://api.thetool.com. Leave blank and the agent will still do the job — it just cannot touch your data in that tool."
            >
              <Input
                id="api-base"
                type="url"
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="https://api.thetool.com"
              />
            </Field>

            <Field
              label="Your API key for it"
              htmlFor="api-key"
              help="Encrypted before it is stored and written straight into your agent's own environment. It is never sent to the model."
            >
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste the key you already have"
              />
            </Field>
          </div>
        </details>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !sourceUrl.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {pending
              ? "Reading the docs…"
              : canBuild
                ? "Build my agent"
                : "Build my agent — on Pro"}
          </Button>
          {pending ? (
            <span className="text-sm text-muted">
              Reading up to six pages, then writing the agent. About a minute.
            </span>
          ) : null}
        </div>
      </form>

      {existing.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-fg-strong">What you have built</h2>

          {existing.map((custom) => (
            <article
              key={custom.id}
              className="rounded-xl border border-line bg-surface-2 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-fg-strong">
                      {custom.spec?.name ?? custom.source_name ?? "Building…"}
                    </h3>
                    <StatusBadge status={custom.status} />
                    {custom.spec?.replaces.monthlyUsd ? (
                      <Badge tone="darkSuccess">
                        saves {formatUsd(custom.spec.replaces.monthlyUsd)}/mo
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1 truncate text-xs text-muted">
                    {custom.source_url} · {formatRelative(custom.created_at)}
                  </p>

                  {custom.spec?.description ? (
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">
                      {custom.spec.description}
                    </p>
                  ) : null}

                  {custom.error ? (
                    <p className="mt-2 flex items-start gap-2 text-sm text-danger">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {custom.error}
                    </p>
                  ) : null}
                </div>

                {custom.status === "ready" ? (
                  <Button size="sm" onClick={() => void setUpAgent(custom.id)}>
                    <Sparkles />
                    Set it up
                  </Button>
                ) : null}
              </div>

              {custom.spec?.api?.endpoints?.length ? (
                <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                  Found {custom.spec.api.endpoints.length} documented endpoints on{" "}
                  <span className="text-muted">{custom.spec.api.baseUrl}</span>
                </p>
              ) : null}

              {custom.sources.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-faint hover:text-muted">
                    What we read ({custom.sources.length} pages)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {custom.sources.map((source) => (
                      <li key={source} className="truncate text-xs text-faint">
                        {source}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return <Badge tone="darkSuccess">Ready</Badge>;
  if (status === "failed") return <Badge tone="darkDanger">Failed</Badge>;
  return <Badge tone="darkAccent">Building…</Badge>;
}
