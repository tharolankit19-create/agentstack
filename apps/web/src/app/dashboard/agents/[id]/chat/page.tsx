import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePaidUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplate, presentationFor } from "@/lib/templates";
import { AgentChat } from "@/components/dashboard/agent-chat";
import type { Agent, ChatMessage } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePaidUser(`/dashboard/agents/${id}/chat`);

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) notFound();
  const template = getTemplate(agent.template_id);
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
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← {agent.name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2.5 text-2xl font-extrabold text-white">
          <span aria-hidden>{presentationFor(template.id).emoji}</span>
          Chat with {agent.name}
        </h1>
      </header>

      <AgentChat
        agentId={agent.id}
        deployed={agent.status === "deployed" && Boolean(agent.deploy_url)}
        paused={agent.paused}
        history={(history ?? []) as ChatMessage[]}
        suggestions={suggestionsFor(template.id)}
      />
    </div>
  );
}

function suggestionsFor(templateId: string): string[] {
  switch (templateId) {
    case "content-agent":
      return [
        "Write 5 tweets about what we shipped this week",
        "Read my site and tell me what my positioning actually says",
        "Write a LinkedIn post about the problem we solve",
      ];
    case "review-agent":
      return [
        "Check for new reviews and draft replies",
        "Draft a reply to the most recent 2-star review",
        "Summarise what people complain about most",
      ];
    case "lead-agent":
      return [
        "Find 10 leads matching my ICP",
        "Write the opening email for lead 1",
        "Which of these leads is the best fit, and why?",
      ];
    default:
      return [];
  }
}
