import Link from "next/link";
import { Loader2, MessageSquare, FileText, Globe } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import type { AgentActivity, Generation, ChatMessage } from "@/lib/supabase/types";

/**
 * What this agent is doing, and what it has just done.
 *
 * Clicking an in-flight card used to land on a page that said the agent
 * existed. The founder's question at that moment is narrower and more urgent:
 * *is it actually working, and on what.* This answers it in one screen — the
 * live label, the pages it has been reading, and the last things it produced —
 * and then hands off to the chat, which is where the conversation lives.
 *
 * The pages come from the trails stored on its own chat replies, so this is a
 * record of real fetches rather than a guess at what it might have looked at.
 * Deduplicated by host: an agent that read six pages on one domain has visited
 * one place, and listing it six times makes the trail look padded.
 */
export function AgentLive({
  agentId,
  activity,
  generations,
  messages,
}: {
  agentId: string;
  activity: AgentActivity[];
  generations: Generation[];
  messages: ChatMessage[];
}) {
  const working = activity[0] ?? null;

  const hosts = new Map<string, { label: string; url?: string; ok: boolean }>();
  for (const message of messages) {
    for (const step of message.trail ?? []) {
      if (step.kind !== "page") continue;
      if (!hosts.has(step.label)) hosts.set(step.label, step);
    }
  }
  const visited = [...hosts.values()].slice(0, 8);

  const madeToday = generations.filter(
    (g) => Date.now() - Date.parse(g.created_at) < 24 * 60 * 60 * 1000,
  );

  return (
    <section id="live" className="ledger scroll-mt-6">
      <header className="ledger-head">
        <h2>Right now</h2>
        <span>{madeToday.length} today</span>
      </header>

      <div className="space-y-4 p-4">
        {working ? (
          <p className="flex items-center gap-2 text-[15px] text-fg">
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />
            {working.label}
            <span className="text-[12px] text-faint">
              started {formatRelative(working.started_at)}
            </span>
          </p>
        ) : (
          <p className="text-[15px] text-muted">
            Not working this minute. It picks up its next turn on schedule, or
            you can set it going from the controls above.
          </p>
        )}

        {visited.length ? (
          <div>
            <p className="microlabel mb-1.5">Pages it has read</p>
            <ul className="flex flex-wrap gap-1.5">
              {visited.map((step) => (
                <li key={step.label}>
                  {step.url ? (
                    <a
                      href={step.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded-[var(--r-control)] border border-line bg-surface-2 px-2 py-1 text-[12px] transition-colors hover:border-line-strong ${
                        step.ok ? "text-muted" : "text-danger"
                      }`}
                    >
                      <Globe className="size-3" aria-hidden />
                      {step.label}
                      {!step.ok ? " · blocked" : null}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {madeToday.length ? (
          <div>
            <p className="microlabel mb-1.5">Filed today</p>
            <ul className="space-y-1">
              {madeToday.slice(0, 5).map((generation) => (
                <li key={generation.id} className="flex items-start gap-2 text-[13.5px]">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {firstLine(generation.content)}
                  </span>
                  <span className="shrink-0 text-[12px] text-faint">
                    {generation.approved ? "approved" : "waiting"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          href={`/dashboard/agents/${agentId}/chat`}
          className="inline-flex items-center gap-2 rounded-[var(--r-control)] border border-line bg-surface-2 px-3 py-2 text-[13.5px] font-semibold text-fg shadow-[var(--shadow-sm)] transition-all hover:border-line-strong hover:shadow-[var(--shadow)] active:translate-y-px"
        >
          <MessageSquare className="size-3.5" aria-hidden />
          Open the conversation
        </Link>
      </div>
    </section>
  );
}

/** The first line with real words — a preview reading "**Subject**" tells nobody anything. */
function firstLine(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
    .find((l) => l.length > 8);
  return (line ?? content.trim()).slice(0, 110);
}
