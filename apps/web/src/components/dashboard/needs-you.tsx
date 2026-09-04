import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { Mission } from "@/lib/missions";

/**
 * The things that stop until the founder answers.
 *
 * Named for what it is rather than what it contains. "Drafts" and "pending
 * approvals" describe the objects; "needs you" describes the obligation, and
 * the obligation is the only reason this block is at the top of the page.
 *
 * An empty state is shown rather than hidden. A founder who opens the dashboard
 * and sees nothing cannot tell whether nothing is waiting or whether the page
 * failed to load, and those are opposite feelings.
 */
export function NeedsYou({ missions, total }: { missions: Mission[]; total: number }) {
  if (!total) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-[15px] font-semibold text-fg-strong">Nothing is waiting on you.</p>
        <p className="mt-1 text-[14px] leading-relaxed text-muted">
          The team is running on its own. Anything that needs an approval or a
          decision will appear here and in your morning message.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-accent-line bg-accent-wash p-5">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[17px] font-bold text-fg-strong">
          {total} {total === 1 ? "thing needs" : "things need"} you
        </h2>
        <Link
          href="/dashboard/missions"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-fg hover:text-fg-strong"
        >
          Mission Control
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <p className="mt-1 text-[14px] text-muted">
        An approval, a decision, or an answer only you can give.
      </p>

      <ul className="mt-4 space-y-2">
        {missions.map((mission) => (
          <li key={mission.id}>
            <Link
              href={mission.href}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong"
            >
              {mission.agentTemplateId ? (
                <AgentAvatar
                  name={mission.agentName ?? "Agent"}
                  seed={mission.agentTemplateId}
                  size={26}
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-fg-strong">
                  {mission.title}
                </p>
                {mission.detail ? (
                  <p className="mt-0.5 truncate text-[13px] text-muted">{mission.detail}</p>
                ) : null}
              </div>

              <span className="shrink-0 self-center text-[12px] font-bold text-accent">
                {mission.asks === "decision" ? "Decide" : "Approve"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {total > missions.length ? (
        <p className="mt-3 text-[13px] text-muted">
          and {total - missions.length} more in Mission Control.
        </p>
      ) : null}
    </section>
  );
}
