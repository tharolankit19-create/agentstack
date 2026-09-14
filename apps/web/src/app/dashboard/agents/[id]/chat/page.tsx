import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { templateForAgent } from "@/lib/agent-view";
import { AgentChat } from "@/components/dashboard/agent-chat";
import type { Agent, ChatMessage, CustomAgent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser(`/dashboard/agents/${id}/chat`);
  const supabase = await createClient();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).maybeSingle<Agent>();
  if (!agent || agent.user_id !== session.userId) notFound();

  const { data: custom } = agent.custom_agent_id
    ? await supabase.from("custom_agents").select("*").eq("id", agent.custom_agent_id).maybeSingle<CustomAgent>()
    : { data: null };
  const template = templateForAgent(agent, custom);
  if (!template) notFound();

  // Use the service client after ownership is proven. This prevents a stale or
  // incomplete browser RLS policy from making a durable conversation look empty.
  const admin = createAdminClient();
  const { data: history } = await admin
    .from("chat_messages")
    .select("*")
    .eq("agent_id", agent.id)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(120);

  return (
    <div className="flex h-[calc(100dvh-5rem)] max-w-3xl flex-col">
      <header className="shrink-0 pb-5">
        <Link href={`/dashboard/agents/${agent.id}`} className="text-sm text-muted transition-colors hover:text-fg">← {agent.name}</Link>
        <h1 className="mt-3 flex items-center gap-2.5 text-2xl font-extrabold text-fg-strong"><span aria-hidden>{template.icon}</span>Chat with {agent.name}</h1>
      </header>
      <AgentChat agentId={agent.id} paused={agent.paused} history={[...(history ?? [])].reverse() as ChatMessage[]} suggestions={template.examples ?? []} />
    </div>
  );
}

