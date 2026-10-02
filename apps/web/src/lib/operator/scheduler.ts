import { Store } from "./store";
import { nextRoutine } from "./policy";
export async function fireRoutines(store: Store) {
  const rows = await store.rpc<
    {
      id: string;
      user_id: string;
      objective: string;
      context: Record<string, unknown>;
      schedule: {
        hour: number;
        minute: number;
        timezone: string;
        weekdays: number[];
      };
      next_run: string;
    }[]
  >("kryx_claim_routines");
  for (const r of rows) {
    try {
      await store.rpc("kryx_create_goal", {
        p_user: r.user_id,
        p_objective: r.objective,
        p_context: { ...r.context, routine_id: r.id },
        p_budget: 100,
        p_key: `routine:${r.id}:${r.next_run}`,
      });
      const next = nextRoutine(r.schedule, new Date());
      await store.update("routines", r.user_id, r.id, {
        last_run: new Date().toISOString(),
        next_run: next,
        lease_until: null,
      });
    } catch (e) {
      await store.update("routines", r.user_id, r.id, {
        lease_until: new Date(Date.now() + 60000).toISOString(),
      });
      throw e;
    }
  }
  return rows.length;
}
