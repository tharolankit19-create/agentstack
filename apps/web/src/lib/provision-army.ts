import "server-only";
import { createAdminClient } from "./supabase/admin";
import { rosterTemplateIds, memberFor, HEAD_AGENT } from "./army";
import { getTemplate } from "./templates";

export async function provisionArmy(userId: string, active: boolean, config?: Record<string, string>) {
  const admin = createAdminClient();
  const { data: existing, error } = await admin.from("agents").select("id, template_id, config")
    .eq("user_id", userId).is("custom_agent_id", null);
  if (error) throw new Error("Could not read your army.");
  const known = new Map((existing ?? []).map(a => [a.template_id, a]));
  const inherited = config ?? known.get(HEAD_AGENT.id)?.config ?? {};
  for (const templateId of rosterTemplateIds()) {
    const old = known.get(templateId);
    const record = {
      config: config ? { ...old?.config, ...config } : old?.config ?? inherited,
      status: active ? "deployed" : "draft", paused: !active,
      deployed_at: active ? new Date().toISOString() : null, last_error: null,
    };
    const result = old
      ? await admin.from("agents").update(record).eq("id", old.id).eq("user_id", userId)
      : await admin.from("agents").insert({ ...record, user_id: userId, template_id: templateId,
          name: templateId === HEAD_AGENT.id ? HEAD_AGENT.defaultName : memberFor(templateId)?.name ?? getTemplate(templateId)?.name ?? templateId });
    if (result.error) throw new Error("Could not finish setting up the army. Your saved setup is safe; retry after the database configuration is updated.");
  }
}
