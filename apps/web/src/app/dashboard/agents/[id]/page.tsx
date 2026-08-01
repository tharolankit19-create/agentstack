import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MessageSquare } from "lucide-react";
import { requirePaidUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplate, presentationFor } from "@/lib/templates";
import { AgentConfigForm } from "@/components/dashboard/agent-config-form";
import { GenerationList } from "@/components/dashboard/generation-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Agent, Generation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePaidUser(`/dashboard/agents/${id}`);

  const supabase = await createClient();

  // RLS scopes this to the signed-in customer, so a guessed id returns nothing.
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) notFound();

  const template = getTemplate(agent.template_id);
  if (!template) notFound();

  const { data: generations } = await supabase
    .from("generations")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← All agents
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                {presentationFor(template.id).emoji}
              </span>
              <h1 className="text-3xl font-extrabold text-white">{agent.name}</h1>
            </div>
            <p className="mt-2 text-[15px] text-zinc-400">{template.description}</p>
          </div>

          {agent.status === "deployed" ? (
            <Badge tone={agent.paused ? "darkWarning" : "darkSuccess"}>
              {agent.paused ? "Stopped" : "Running"}
            </Badge>
          ) : null}
        </div>

        {agent.deploy_url ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a href={agent.deploy_url} target="_blank" rel="noreferrer">
              <Button variant="darkOutline" size="sm">
                <ExternalLink />
                Open agent URL
              </Button>
            </a>
            <Link href={`/dashboard/agents/${agent.id}/chat`}>
              <Button size="sm">
                <MessageSquare />
                Chat with this agent
              </Button>
            </Link>
          </div>
        ) : null}

        {agent.last_error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm leading-relaxed text-red-300"
          >
            {agent.last_error}
          </p>
        ) : null}
      </header>

      <AgentConfigForm agent={agent} template={template} />

      <section>
        <h2 className="text-xl font-bold text-white">Recent output</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Everything this agent has written, newest first.
        </p>
        <div className="mt-5">
          <GenerationList generations={(generations ?? []) as Generation[]} />
        </div>
      </section>
    </div>
  );
}
