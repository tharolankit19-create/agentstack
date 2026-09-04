import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMissions, needsYouCount } from "@/lib/missions";
import { MissionBoard } from "@/components/dashboard/mission-board";

export const dynamic = "force-dynamic";

/**
 * Mission Control.
 *
 * Every piece of work the army is doing, in one place, with the things blocked
 * on the founder first. Before this the same work was spread across four
 * tables and three pages, and the founder's only reliable way to find what was
 * waiting on them was to read a Telegram message and hope it was complete.
 */
export default async function MissionsPage() {
  const session = await requireUser("/dashboard/missions");
  const admin = createAdminClient();
  const missions = await loadMissions(admin, session.userId);
  const waiting = needsYouCount(missions);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-fg-strong">
          Mission Control
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {waiting
            ? `${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting on you. Everything else is running.`
            : "Nothing is waiting on you. Everything here is running on its own."}
        </p>
      </header>

      <MissionBoard missions={missions} />
    </div>
  );
}
