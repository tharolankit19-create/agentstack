"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pause, Play, Rocket, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolIcon } from "@/components/ui/tool-icon";
import { formatUsd, type AgentTemplate } from "@/lib/templates";
import { logosForTools } from "@/lib/tool-domains";
import { formatRelative, pluralize } from "@/lib/utils";
import { usePaywall } from "./paywall";
import type { Agent, AgentStats } from "@/lib/supabase/types";

/**
 * One card per agent, in one of two states: not created yet (a template the
 * customer can start), or created (with its live status, URL, and counters).
 */
export function AgentCard({
  template,
  agent,
  stats,
  quotaReached,
}: {
  template: AgentTemplate;
  agent?: Agent;
  stats?: AgentStats;
  quotaReached: boolean;
}) {
  const router = useRouter();
  const paywall = usePaywall();
  const [busy, setBusy] = useState<"create" | "deploy" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy("create");
    setError(null);
    try {
      const payload = await paywall.guard<{ id?: string }>(
        () =>
          fetch("/api/agents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ templateId: template.id }),
          }),
        `Add ${template.name} to your stack`,
      );

      if (!payload) {
        setBusy(null);
        return;
      }
      if (!payload.id) throw new Error("Could not create that agent.");
      router.push(`/dashboard/agents/${payload.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function deploy() {
    if (!agent) return;
    setBusy("deploy");
    setError(null);
    try {
      const payload = await paywall.guard(
        () => fetch(`/api/agents/${agent.id}/deploy`, { method: "POST" }),
        `Turn ${agent.name} on`,
      );

      if (!payload) {
        setBusy(null);
        return;
      }
      router.push("/dashboard/deploy");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deploy failed.");
      setBusy(null);
    }
  }

  async function toggle() {
    if (!agent) return;
    setBusy("toggle");
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agent.id}/toggle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !agent.paused }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not change that.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card dark className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="text-3xl" aria-hidden>
          {template.icon}
        </div>
        <StatusBadge agent={agent} />
      </div>

      <h3 className="mt-4 text-lg font-bold text-fg-strong">{template.name}</h3>

      {/* The subscriptions this card is asking you to cancel, as their own
          logos. A founder scanning the library recognises the icon of the
          thing they pay for long before they read its name. */}
      {template.replaces.tools.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {logosForTools(template.replaces.tools).map((tool) => (
            <span
              key={tool.slug}
              title={`Replaces ${tool.tool}`}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-1 pr-2 text-[11px] font-semibold text-muted"
            >
              <ToolIcon
                domain={tool.domain}
                name={tool.tool}
                className="size-4 rounded"
              />
              {tool.tool}
            </span>
          ))}

          {template.replaces.monthlyUsd > 0 ? (
            <span className="text-[11px] font-bold text-live">
              {formatUsd(template.replaces.monthlyUsd)}/mo
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
        {template.description}
      </p>

      {agent ? (
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Last run</dt>
            <dd className="mt-0.5 font-semibold text-fg">
              {formatRelative(stats?.last_run_at ?? agent.last_run_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">This month</dt>
            <dd className="mt-0.5 font-semibold text-fg">
              {pluralize(stats?.generations_this_month ?? 0, "draft")}
            </dd>
          </div>
        </dl>
      ) : null}

      {agent?.deploy_url ? (
        <a
          href={agent.deploy_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center gap-1.5 truncate text-xs font-medium text-accent hover:underline"
        >
          <ExternalLink className="size-3 shrink-0" />
          <span className="truncate">{agent.deploy_url.replace(/^https?:\/\//, "")}</span>
        </a>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {!agent ? (
          <Button
            onClick={create}
            disabled={busy !== null || quotaReached}
            size="sm"
            className="flex-1"
          >
            {busy === "create" ? <Loader2 className="animate-spin" /> : null}
            {quotaReached ? "Agent limit reached" : "Configure this agent"}
          </Button>
        ) : (
          <>
            <Link href={`/dashboard/agents/${agent.id}`} className="flex-1">
              <Button variant="darkOutline" size="sm" className="w-full">
                <Settings />
                Configure
              </Button>
            </Link>

            <Button
              onClick={deploy}
              disabled={busy !== null || agent.status === "deploying"}
              size="sm"
              className="flex-1"
            >
              {busy === "deploy" || agent.status === "deploying" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Rocket />
              )}
              {agent.status === "deployed" ? "Redeploy" : "Deploy"}
            </Button>

            {agent.status === "deployed" ? (
              <Button
                onClick={toggle}
                disabled={busy !== null}
                variant="ghost"
                size="icon"
                aria-label={agent.paused ? "Start agent" : "Stop agent"}
                title={agent.paused ? "Start agent" : "Stop agent"}
                className="text-muted hover:bg-surface-2 hover:text-fg-strong"
              >
                {busy === "toggle" ? (
                  <Loader2 className="animate-spin" />
                ) : agent.paused ? (
                  <Play />
                ) : (
                  <Pause />
                )}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function StatusBadge({ agent }: { agent?: Agent }) {
  if (!agent) return <Badge tone="darkNeutral">Not set up</Badge>;
  if (agent.status === "error") return <Badge tone="darkDanger">Error</Badge>;
  if (agent.status === "deploying") return <Badge tone="darkAccent">Deploying…</Badge>;
  if (agent.status === "deployed") {
    return agent.paused ? (
      <Badge tone="darkWarning">Stopped</Badge>
    ) : (
      <Badge tone="darkSuccess">Running</Badge>
    );
  }
  if (agent.status === "configured") return <Badge tone="darkNeutral">Ready to deploy</Badge>;
  return <Badge tone="darkNeutral">Draft</Badge>;
}
