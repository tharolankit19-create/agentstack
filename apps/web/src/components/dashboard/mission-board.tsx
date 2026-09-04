import Link from "next/link";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { LANES, inLane, type Mission } from "@/lib/missions";

/**
 * The board.
 *
 * Four lanes, and the first one is the only one that costs anything to ignore.
 * "Needs you" is always leftmost, always expanded, and carries a count even
 * when empty — an empty column that says nothing is waiting is worth as much as
 * a full one, because the founder came here to find out which it is.
 *
 * Deliberately not drag-and-drop. Nothing here moves because a human dragged
 * it: a draft becomes done when it is approved, a mission goes in flight when
 * an agent picks it up. Handles that imply a rearrangement the system will
 * immediately undo are worse than no handles.
 */
export function MissionBoard({ missions }: { missions: Mission[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {LANES.map((lane) => {
        const items = inLane(missions, lane.id);
        const urgent = lane.id === "needs_you";

        return (
          <section
            key={lane.id}
            className={
              urgent
                ? "rounded-xl border border-accent-line bg-accent-wash p-3"
                : "rounded-xl border border-line bg-surface-2 p-3"
            }
          >
            <header className="px-1.5 pb-3">
              <h2 className="flex items-baseline gap-2 text-[15px] font-bold text-fg-strong">
                {lane.name}
                <span
                  className={
                    urgent && items.length
                      ? "rounded-full bg-accent px-1.5 text-[12px] font-bold text-accent-fg"
                      : "text-[13px] font-semibold text-muted"
                  }
                >
                  {items.length}
                </span>
              </h2>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{lane.blurb}</p>
            </header>

            {items.length ? (
              <ul className="space-y-2">
                {items.map((mission) => (
                  <li key={mission.id}>
                    <MissionCard mission={mission} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[13px] text-faint">
                {emptyLine(lane.id)}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * What an empty lane says.
 *
 * Written per lane because "nothing here" means something different in each,
 * and an empty "needs you" is genuinely good news that deserves to read like it.
 */
function emptyLine(lane: string): string {
  if (lane === "needs_you") return "Nothing waiting on you.";
  if (lane === "in_flight") return "Nobody working this minute.";
  if (lane === "queued") return "Nothing scheduled.";
  return "Nothing finished yet today.";
}

function MissionCard({ mission }: { mission: Mission }) {
  return (
    <Link
      href={mission.href}
      className="block rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong"
    >
      {mission.asks ? (
        <p className="mb-1.5 text-[11.5px] font-bold text-accent">
          {mission.asks === "approval" ? "Needs your approval" : "Needs your decision"}
        </p>
      ) : null}

      <p className="text-[14px] font-semibold leading-snug text-fg-strong">{mission.title}</p>

      {mission.detail ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{mission.detail}</p>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2">
        {mission.agentTemplateId ? (
          <AgentAvatar
            name={mission.agentName ?? "Agent"}
            seed={mission.agentTemplateId}
            size={18}
          />
        ) : null}
        {mission.agentName ? (
          <span className="text-[12px] font-medium text-muted">{mission.agentName}</span>
        ) : null}
        <time dateTime={mission.at} className="ml-auto text-[12px] text-faint">
          {ago(mission.at)}
        </time>
      </div>
    </Link>
  );
}

/** Phone-width relative time. Future times read forwards: "in 2h". */
function ago(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const ahead = diff < 0;
  const minutes = Math.round(Math.abs(diff) / 60_000);

  const label =
    minutes < 1
      ? "now"
      : minutes < 60
        ? `${minutes}m`
        : minutes < 1440
          ? `${Math.round(minutes / 60)}h`
          : `${Math.round(minutes / 1440)}d`;

  return ahead && label !== "now" ? `in ${label}` : label;
}
