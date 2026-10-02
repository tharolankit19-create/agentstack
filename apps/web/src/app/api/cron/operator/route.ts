import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCron } from "@/lib/cron-auth";
import { Store } from "@/lib/operator/store";
import { advanceOperator } from "@/lib/operator/runner";
import { dispatchApprovals } from "@/lib/operator/gateway";
import { fireRoutines } from "@/lib/operator/scheduler";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!(await authorizeCron(req)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  // The heartbeat has a 15-second dispatch timeout. Acknowledge first; durable
  // leases and the next heartbeat recover interrupted background execution.
  after(async () => {
    const store = new Store(createAdminClient());
    try {
      await store.rpc("kryx_reconcile");
      await fireRoutines(store);
      await dispatchApprovals(store);
      await advanceOperator(3);
    } catch {
      console.error("Kryx operator dispatch interrupted; queue retained.");
    }
  });
  return Response.json({ accepted: true }, { status: 202 });
}
