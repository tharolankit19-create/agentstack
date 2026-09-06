import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { Agent } from "./supabase/types";

type Admin = ReturnType<typeof createAdminClient>;
export type Reporter = (message: string) => Promise<void>;

/** Only call this with observed tool events; never model-generated progress. */
export function reporterFor(admin: Admin, agent: Pick<Agent, "id" | "user_id" | "template_id">): Reporter {
  return async (body) => {
    const { error } = await admin.from("room_messages").insert({
      user_id: agent.user_id, agent_id: agent.id,
      template_id: agent.template_id, body: body.slice(0, 1000),
    });
    if (error) console.error("[work-report] persistence failed", error.code);
  };
}

export async function notifyFounder(admin: Admin, userId: string, text: string) {
  const { data } = await admin.from("telegram_links").select("chat_id")
    .eq("user_id", userId).maybeSingle<{ chat_id: string | null }>();
  if (!data?.chat_id) return false;
  const { sendMessage } = await import("./telegram");
  return sendMessage(data.chat_id, text.slice(0, 3500));
}
