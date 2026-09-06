import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { templateForAgent } from "@/lib/agent-view";
import { AgentChat } from "@/components/dashboard/agent-chat";
import type { Agent, ChatMessage, CustomAgent } from "@/lib/supabase/types";
import { GenerationList } from "@/components/dashboard/generation-list";
import { WorkProgress } from "@/components/dashboard/work-progress";
import type { Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ output?: string; task?: string }>;
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

  const { data: history, error: historyError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const query = await searchParams;
  const { data: outputs } = query.output ? await supabase.from("generations")
    .select("*").eq("agent_id", agent.id).eq("id", query.output) : { data: [] };
  const { data: task } = query.task ? await supabase.from("scheduled_tasks")
    .select("id, instruction, status, result, error").eq("agent_id", agent.id).eq("id", query.task).maybeSingle() : { data: null };

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] max-w-3xl flex-col gap-4">
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
      {historyError && <p role="alert" className="text-danger">Chat history could not be loaded. Refresh to try again; your messages have not been deleted.</p>}
      {outputs?.length ? <GenerationList generations={outputs as Generation[]} /> : null}
      {task && <article id={`task-${task.id}`} className="rounded-xl border border-line p-4">
        <p className="font-bold">{task.instruction}</p><p className="text-sm text-muted">{task.status}</p>
        <p className="whitespace-pre-wrap">{task.result || task.error}</p>
      </article>}
      <WorkProgress agentId={agent.id} />

      <AgentChat
        agentId={agent.id}
        paused={agent.paused}
        history={((history ?? []) as ChatMessage[]).reverse()}
        suggestions={template.examples ?? []}
      />
    </div>
  );
}
