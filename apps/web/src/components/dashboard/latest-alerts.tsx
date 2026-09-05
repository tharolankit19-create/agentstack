import Link from "next/link";
import { initialsFor, refFor } from "@/lib/ref";
import { displayName } from "@/lib/army";
import { getTemplate } from "@/lib/templates";
import type { Agent, Generation } from "@/lib/supabase/types";

/**
 * The newest thing each agent said, one line each.
 *
 * This replaced a stack of panels — a live activity animation, a roster with
 * per-agent statistics, a brief listing every generation — that between them
 * answered "is the machine on?" three times and "what did my team find?" not
 * at all. A founder opening this on a phone has one question, and it is the
 * second one.
 *
 * One row per agent, not one per output. An agent that produced six things
 * today appears once, with its latest, because the point is coverage: which of
 * the team has something for you, and which has been quiet. The full history
 * per agent is one click away and belongs there rather than here.
 *
 * Drawn as a ledger rather than a list of cards. The generated avatars that
 * used to sit here were decoration — twelve coloured circles that carried no
 * information — and they have been replaced by the rail: initials on a
 * continuous hairline, so a screen of entries reads as one team's shift.
 * Every line carries its reference, which is what lets the founder say "OTS-4B21"
 * to the head agent instead of "the third one down".
 */
export function LatestAlerts({
  agents,
  generations,
}: {
  agents: Agent[];
  generations: Generation[];
}) {
  // Newest first, then keep the first sighting of each agent.
  const newest = new Map<string, Generation>();
  for (const generation of generations) {
    if (!newest.has(generation.agent_id)) newest.set(generation.agent_id, generation);
  }

  const rows = agents
    .map((agent) => ({ agent, latest: newest.get(agent.id) ?? null }))
    .sort((a, b) => {
      // Agents with something to say come first, newest at the top. Silent
      // agents sink rather than disappear — a squad that has gone quiet is
      // information, and hiding it is how a broken agent stays broken.
      if (a.latest && !b.latest) return -1;
      if (!a.latest && b.latest) return 1;
      if (!a.latest || !b.latest) return 0;
      return Date.parse(b.latest.created_at) - Date.parse(a.latest.created_at);
    });

  if (!rows.length) return null;

  const filed = rows.filter((row) => row.latest).length;

  return (
    <section className="ledger">
      <header className="ledger-head">
        <h2>Latest from each agent</h2>
        <Link href="/dashboard/agents" className="hover:text-fg">
          {filed}/{rows.length} filed &middot; all agents &rarr;
        </Link>
      </header>

      <ul>
        {rows.map(({ agent, latest }) => {
          const template = getTemplate(agent.template_id);
          const name = displayName(agent.template_id, agent.name, template?.name);

          return (
            <li key={agent.id} className="ledger-row">
              <div className="spine">
                <span aria-hidden>{initialsFor(name)}</span>
              </div>

              <Link
                href={`/dashboard/agents/${agent.id}`}
                className="min-w-0 px-4 py-3.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-fg-strong">{name}</span>
                  {latest ? (
                    <>
                      <span className="ref shrink-0">{refFor(name, latest.id)}</span>
                      <time
                        dateTime={latest.created_at}
                        className="ml-auto shrink-0 text-xs text-muted tabular-nums"
                      >
                        {ago(latest.created_at)}
                      </time>
                    </>
                  ) : (
                    <span className="stamp stamp-done ml-auto">quiet</span>
                  )}
                </div>

                <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
                  {latest ? firstLine(latest.content) : "Nothing yet — it reports on its own schedule."}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The opening of a draft, without its scaffolding.
 *
 * Agent output often starts with a heading or a label, and a preview that reads
 * "**Subject**" tells the founder nothing about whether to open it. This finds
 * the first line with actual words in it.
 */
function firstLine(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
    .find((l) => l.length > 12);

  return (line ?? content.trim()).slice(0, 160);
}

/** "4m", "3h", "2d" — a phone-width timestamp. */
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
