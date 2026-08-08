import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { templateForAgent } from "@/lib/agent-view";
import { AgentChat } from "@/components/dashboard/agent-chat";
import type { Agent, ChatMessage, CustomAgent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/dashboard/agents/${id}/chat`);

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) notFound();
  const { data: custom } = agent.custom_agent_id
    ? await supabase
        .from("custom_agents")
        .select("*")
        .eq("id", agent.custom_agent_id)
        .maybeSingle<CustomAgent>()
    : { data: null };

  const template = templateForAgent(agent, custom);
  if (!template) notFound();

  const { data: history } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true })
    .limit(60);

  return (
    <div className="flex h-[calc(100dvh-5rem)] max-w-3xl flex-col">
      <header className="shrink-0 pb-5">
        <Link
          href={`/dashboard/agents/${agent.id}`}
          className="text-sm text-muted transition-colors hover:text-muted"
        >
          ← {agent.name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2.5 text-2xl font-extrabold text-fg-strong">
          <span aria-hidden>{template.icon}</span>
          Chat with {agent.name}
        </h1>
      </header>

      <AgentChat
        agentId={agent.id}
        deployed={agent.status === "deployed" && Boolean(agent.deploy_url)}
        paused={agent.paused}
        history={(history ?? []) as ChatMessage[]}
        suggestions={template.examples ?? []}
      />
    </div>
  );
}
