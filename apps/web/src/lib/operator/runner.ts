import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { Store } from "./store";
import { Operator } from "./engine";
import { ProductionProviders } from "./providers";
import { proposeEmail } from "./gateway";
import { dispatchNotifications } from "./notifications";
export async function advanceOperator(rounds = 1, maxMilliseconds = 250000) {
  const store = new Store(createAdminClient()),
    deadline = Date.now() + Math.min(250000, Math.max(0, maxMilliseconds));
  await store.rpc("kryx_reconcile");
  const operator = new Operator(
    store,
    async (t) => {
      const p = new ProductionProviders(store, t);
      await p.initialize();
      return p;
    },
    (t, e) => proposeEmail(store, t, e),
  );
  let worked = 0;
  for (let i = 0; i < rounds && deadline - Date.now() > 180000; i++) {
    const count = await operator.tick();
    worked += count;
    if (!count) break;
  }
  await store.rpc("kryx_reconcile");
  await dispatchNotifications(store);
  return worked;
}
