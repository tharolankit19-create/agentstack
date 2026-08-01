"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative, pluralize } from "@/lib/utils";
import type { Agent, AgentStats } from "@/lib/supabase/types";

/**
 * One deployed agent.
 *
 * While a build is running this polls the status endpoint, so the customer
 * watches a build finish instead of guessing when to refresh.
 */
export function DeploymentRow({
  agent,
  templateName,
  emoji,
  stats,
}: {
  agent: Agent;
  templateName: string;
  emoji: string;
  stats?: AgentStats;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(agent.status);
  const [url, setUrl] = useState(agent.deploy_url);
  const [error, setError] = useState(agent.last_error);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "deploying") return;

    let attempts = 0;
    const poll = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/agents/${agent.id}/status`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          status?: string;
          url?: string | null;
          error?: string | null;
        };

        if (payload.status && payload.status !== "deploying") {
          setStatus(payload.status as Agent["status"]);
          setUrl(payload.url ?? null);
          setError(payload.error ?? null);
          window.clearInterval(poll);
          router.refresh();
        }
      } catch {
        /* a failed poll is not a failed build */
      }
      // ~5 minutes. A Next build that has not finished by then has a problem.
      if (attempts >= 60) window.clearInterval(poll);
    }, 5000);

    return () => window.clearInterval(poll);
  }, [status, agent.id, router]);

  async function runNow() {
    setRunning(true);
    setRunMessage(null);
    try {
      const response = await fetch(`/api/agents/${agent.id}/run`, { method: "POST" });
      const payload = (await response.json()) as {
        generations?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "The run failed.");
      setRunMessage(
        `Done — ${pluralize(payload.generations ?? 0, "new draft")}. Open the agent to read them.`,
      );
      router.refresh();
    } catch (cause) {
      setRunMessage(cause instanceof Error ? cause.message : "The run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-surface-line)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span aria-hidden>{emoji}</span>
            <Link
              href={`/dashboard/agents/${agent.id}`}
              className="font-bold text-white hover:underline"
            >
              {agent.name}
            </Link>
            <StatusBadge status={status} paused={agent.paused} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{templateName}</p>

          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-1.5 text-sm text-[#c4b5fd] hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <div className="text-sm">
            <p className="text-zinc-500">
              Last run{" "}
              <span className="font-medium text-zinc-300">
                {formatRelative(stats?.last_run_at ?? agent.last_run_at)}
              </span>
            </p>
            <p className="text-zinc-500">
              <span className="font-medium text-zinc-300">
                {stats?.generations_this_month ?? 0}
              </span>{" "}
              drafts this month
            </p>
          </div>

          {status === "deployed" && !agent.paused ? (
            <Button onClick={runNow} disabled={running} variant="darkOutline" size="sm">
              {running ? <Loader2 className="animate-spin" /> : <PlayCircle />}
              Run now
            </Button>
          ) : null}
        </div>
      </div>

      {status === "deploying" ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--color-accent)]/10 px-3.5 py-2.5 text-sm text-[#c4b5fd]">
          <Loader2 className="size-4 animate-spin" />
          Building. This takes about 90 seconds.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {runMessage ? (
        <p className="mt-4 rounded-lg border border-[var(--color-surface-line)] px-3.5 py-2.5 text-sm text-zinc-300">
          {runMessage}
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, paused }: { status: string; paused: boolean }) {
  if (status === "deploying") return <Badge tone="darkAccent">Deploying</Badge>;
  if (status === "error") return <Badge tone="darkDanger">Error</Badge>;
  if (status === "deployed") {
    return paused ? (
      <Badge tone="darkWarning">Stopped</Badge>
    ) : (
      <Badge tone="darkSuccess">Running</Badge>
    );
  }
  return <Badge tone="darkNeutral">Not deployed</Badge>;
}
