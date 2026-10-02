import "server-only";
import { z } from "zod";
import { loadConnectors } from "@/lib/connectors";
import { createAdminClient } from "@/lib/supabase/admin";
import { Store } from "./store";
import type { Task } from "./contracts";
import { decide, fingerprint, redact, actions } from "./policy";
export const emailSchema = z
  .object({
    from: z.email(),
    to: z.email(),
    subject: z.string().min(1).max(200),
    text: z.string().min(1).max(12000),
  })
  .strict();
export async function proposeEmail(store: Store, t: Task, payload: unknown) {
  const parsed = emailSchema.parse(payload),
    action = "email.send";
  const rules = await store.rows<{ action: string; decision: string }>(
    "approval_rules",
    t.user_id,
  );
  const policy = decide(
    action,
    rules.find((r) => r.action === action)?.decision,
  );
  if (policy === "DENY") {
    await store.event(t, "action.denied", { action });
    return null;
  }
  const q = await store.db.from("kryx_approvals").upsert(
    {
      user_id: t.user_id,
      goal_id: t.goal_id,
      task_id: t.id,
      action,
      risk: actions[action],
      payload: parsed,
      fingerprint: fingerprint(action, parsed),
      status: policy === "ALLOW" ? "APPROVED" : "PENDING",
    },
    { onConflict: "task_id,fingerprint", ignoreDuplicates: true },
  );
  if (q.error) throw new Error(q.error.message);
  await store.event(t, "approval.requested", { action, to: parsed.to });
  return parsed;
}
export async function dispatchApprovals(store: Store) {
  const q = await store.db
    .from("kryx_approvals")
    .select("*")
    .eq("status", "APPROVED")
    .limit(5);
  if (q.error) throw new Error(q.error.message);
  for (const row of q.data) {
    let claimed = false;
    let secrets: string[] = [];
    try {
      if (row.action !== "email.send")
        throw new Error("Action execution provider unavailable");
      const email = emailSchema.parse(row.payload);
      if (fingerprint(row.action, email) !== row.fingerprint)
        throw new Error("Approved payload changed");
      const keys = await loadConnectors(createAdminClient(), row.user_id);
      if (!keys.resend || !keys.resend_webhook)
        throw new Error(
          "Connect Resend and its verified delivery webhook before sending",
        );
      const rules = await store.rows<{ action: string; decision: string }>(
        "approval_rules",
        row.user_id,
      );
      if (
        decide(
          row.action,
          rules.find((r) => r.action === row.action)?.decision,
        ) === "DENY"
      ) {
        await store.update("approvals", row.user_id, row.id, {
          status: "DENIED",
          error: "Blocked by current approval policy",
        });
        continue;
      }
      const suppressed = await store.db
        .from("kryx_email_suppressions")
        .select("email")
        .eq("user_id", row.user_id)
        .eq("email", email.to.toLowerCase())
        .maybeSingle();
      if (suppressed.error) throw new Error("Suppression check unavailable");
      if (suppressed.data) {
        await store.update("approvals", row.user_id, row.id, {
          status: "DENIED",
          error: "Recipient is suppressed",
        });
        continue;
      }
      secrets = [keys.resend];
      await store.rpc("kryx_consume_approval", {
        p_user: row.user_id,
        p_id: row.id,
        p_fingerprint: row.fingerprint,
      });
      claimed = true;
      const result = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: "Bearer " + keys.resend,
          "content-type": "application/json",
          "Idempotency-Key": "kryx-" + row.id,
        },
        body: JSON.stringify(email),
        signal: AbortSignal.timeout(45000),
      });
      if (!result.ok)
        throw new Error("Email provider returned " + result.status);
      const body = await result.json();
      if (!body.id) throw new Error("Missing delivery acknowledgement");
      await store.update("approvals", row.user_id, row.id, {
        status: "EXECUTED",
        provider_id: body.id,
      });
      await store.event(
        { id: row.task_id, user_id: row.user_id, goal_id: row.goal_id } as Task,
        "action.executed",
        { action: row.action, provider_id: body.id },
      );
    } catch (e) {
      const message = String(
        redact(e instanceof Error ? e.message : "Action failed", secrets),
      );
      if (claimed)
        await store.update("approvals", row.user_id, row.id, {
          status: "UNKNOWN",
          error: message,
        });
      else
        await store.update("approvals", row.user_id, row.id, {
          error: message,
        });
    }
  }
}
