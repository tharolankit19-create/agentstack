import Link from "next/link";
import { initialsFor, refFor } from "@/lib/ref";
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
 *
 * Drawn as four ledgers rather than four card columns. Square frames, an
 * accent rule across the head, a stamp where a status pill used to be, and a
 * reference on every entry — the same language as the rest of the dashboard,
 * and none of it is a colour choice, which is the point.
 */
export function MissionBoard({ missions }: { missions: Mission[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {LANES.map((lane) => {
        const items = inLane(missions, lane.id);
        const urgent = lane.id === "needs_you";

        return (
          <section key={lane.id} className={urgent ? "ledger ticked" : "ledger"}>
            <header className="ledger-head">
              <h2>{lane.name}</h2>
              <span>
                {String(items.length).padStart(2, "0")}
              </span>
            </header>

            <p className="border-b border-line px-4 py-2 text-[12.5px] leading-snug text-muted">
              {lane.blurb}
            </p>

            {items.length ? (
              <ul>
                {items.map((mission) => (
                  <li key={mission.id} className="ledger-row">
                    <div className="spine">
                      <span aria-hidden>
                        {mission.agentName ? initialsFor(mission.agentName) : "—"}
                      </span>
                    </div>
                    <MissionCard mission={mission} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-faint">
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
    <Link href={mission.href} className="block min-w-0 px-4 py-3">
      {mission.asks ? (
        <span className="stamp stamp-wait mb-2">
          {mission.asks === "approval" ? "approve" : "decide"}
        </span>
      ) : null}

      <p className="text-[14px] font-semibold leading-snug text-fg-strong">{mission.title}</p>

      {mission.detail ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{mission.detail}</p>
      ) : null}

      <div className="mt-2.5 flex items-center gap-2">
        <span className="ref">{refFor(mission.agentName, mission.id)}</span>
        {mission.agentName ? (
          <span className="truncate text-[12px] font-medium text-muted">{mission.agentName}</span>
        ) : null}
        <time dateTime={mission.at} className="ml-auto shrink-0 text-[12px] tabular-nums text-faint">
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
