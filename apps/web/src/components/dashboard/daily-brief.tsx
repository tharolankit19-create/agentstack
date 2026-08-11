import Link from "next/link";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { getTemplate } from "@/lib/templates";
import { displayName } from "@/lib/army";
import type { Agent, Generation } from "@/lib/supabase/types";

/**
 * What your agents did while you were not here.
 *
 * The dashboard used to open with a browse list — every tool you might
 * cancel — and that is a catalogue, not a product. A catalogue is something
 * you look at once. The reason to open this tab tomorrow is that work happened
 * overnight and it is sitting here waiting to be read.
 *
 * So this is the first thing on the page, and it is built from real rows:
 * actual generations, with their real timestamps, from agents that actually
 * ran. There is no invented "3 insights found" — if nothing ran, it says
 * nothing ran, because a brief that manufactures activity is one a founder
 * stops trusting within a week.
 */
export function DailyBrief({
  generations,
  agents,
  deployedCount,
}: {
  generations: Generation[];
  agents: Agent[];
  deployedCount: number;
}) {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

  const nameFor = (generation: Generation): string => {
    const agent = agentsById.get(generation.agent_id);
    if (!agent) return "An agent";
    // Its name, not its job title. Accounts created before the army had names
    // still have "Content Agent" in the row, so this resolves through the
    // roster rather than trusting what was written at insert time.
    return displayName(
      agent.template_id,
      agent.name,
      getTemplate(agent.template_id)?.name,
    );
  };

  if (deployedCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line p-6">
        <p className="flex items-center gap-2 font-bold text-fg-strong">
          <Sparkles className="size-4 text-accent" aria-hidden />
          Nothing has run yet
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
          This is where tomorrow morning&rsquo;s work will be — drafts written,
          replies prepared, leads found, all of it done before you opened the
          tab. Turn on your first agent and this page stops being empty for
          good.
        </p>
      </section>
    );
  }

  if (generations.length === 0) {
    return (
      <section className="rounded-2xl border border-line bg-surface-2 p-6">
        <p className="flex items-center gap-2 font-bold text-fg-strong">
          <Clock className="size-4 text-money" aria-hidden />
          {deployedCount} running, nothing produced yet
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          They run on a schedule, so the first output lands at the next
          scheduled time rather than the moment you deploy. Nothing is wrong.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-fg-strong">
            While you were away
          </h2>
          <p className="mt-1 text-sm text-muted">
            {generations.length === 1
              ? "One thing landed"
              : `${generations.length} things landed`}{" "}
            from {deployedCount} running {deployedCount === 1 ? "agent" : "agents"}.
            Social posts are written for you to publish by hand — nothing goes
            out on its own.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {generations.map((generation) => (
          <li key={generation.id}>
            <Link
              href={`/dashboard/agents/${generation.agent_id}`}
              className="panel-interactive flex items-start gap-4 p-4 hover:border-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-fg-strong">
                    {nameFor(generation)}
                  </span>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {generation.kind}
                  </span>
                  {/* Social posts are written but never published — the label
                      has to say so here, not only in the Telegram message. */}
                  {generation.kind === "tweet" || generation.kind === "linkedin" ? (
                    <span className="rounded-full border border-money/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-money">
                      you post this
                    </span>
                  ) : null}
                  <span className="text-xs text-faint">
                    {formatRelative(generation.created_at)}
                  </span>
                </p>
                {/* One line. The full text is on the agent's own page — this is
                    a brief, and a brief that needs scrolling is a feed. */}
                <p className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-muted">
                  {generation.content}
                </p>
              </div>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-faint"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
