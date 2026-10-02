import "server-only";
import { sendMessage } from "@/lib/telegram";
import { Store } from "./store";
export async function dispatchNotifications(store: Store) {
  const deadline = Date.now() + 15000;
  const q = await store.db
    .from("kryx_notifications")
    .select("*")
    .eq("status", "QUEUED")
    .limit(10);
  if (q.error) throw new Error(q.error.message);
  for (const n of q.data) {
    if (Date.now() >= deadline) break;
    const link = await store.db
      .from("telegram_links")
      .select("chat_id")
      .eq("user_id", n.user_id)
      .maybeSingle();
    if (!link.data?.chat_id) continue;
    const claimed = await store.db
      .from("kryx_notifications")
      .update({ status: "SENDING", started_at: new Date().toISOString() })
      .eq("id", n.id)
      .eq("user_id", n.user_id)
      .eq("status", "QUEUED")
      .select("id");
    if (claimed.error || !claimed.data?.length) continue;
    const text =
      String(n.text) +
      "\n\n" +
      (process.env.NEXT_PUBLIC_APP_URL || "https://getkryxai.com") +
      "/dashboard/tasks/" +
      n.goal_id;
    const ok = await sendMessage(link.data.chat_id, text);
    await store.update("notifications", n.user_id, n.id, {
      status: ok ? "SENT" : "UNKNOWN",
    });
  }
}
