import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { Store } from "@/lib/operator/store";
import { Operator } from "@/lib/operator/engine";
import { ProductionProviders } from "@/lib/operator/providers";
import { proposeEmail, dispatchApprovals } from "@/lib/operator/gateway";
import { dispatchNotifications } from "@/lib/operator/notifications";
import { fireRoutines } from "@/lib/operator/scheduler";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!(await authorizeCron(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const store = new Store(createAdminClient());
  await store.rpc("kryx_reconcile");
  const routines = await fireRoutines(store);
  await dispatchApprovals(store);
  const operator = new Operator(
    store,
    async (t) => {
      const p = new ProductionProviders(store, t);
      await p.initialize();
      return p;
    },
    (t, e) => proposeEmail(store, t, e),
  );
  const worked = await operator.tick();
  await store.rpc("kryx_reconcile");
  await dispatchNotifications(store);
  return Response.json({ routines, worked });
}
