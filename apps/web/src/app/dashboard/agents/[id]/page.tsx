import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { templateForAgent } from "@/lib/agent-view";
import { AgentConfigForm } from "@/components/dashboard/agent-config-form";
import { AgentControls } from "@/components/dashboard/agent-controls";
import { GenerationList } from "@/components/dashboard/generation-list";
import { AgentMemoryPanel } from "@/components/dashboard/agent-memory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { displayName, memberFor } from "@/lib/army";
import type {
  Agent,
  AgentNote,
  CustomAgent,
  Generation,
  PromptRevision,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/dashboard/agents/${id}`);

  const supabase = await createClient();

  // RLS scopes this to the signed-in customer, so a guessed id returns nothing.
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .maybeSingle<Agent>();

  if (!agent) notFound();

  // A generated agent's "template" comes from the spec we built for it.
  const { data: custom } = agent.custom_agent_id
    ? await supabase
        .from("custom_agents")
        .select("*")
        .eq("id", agent.custom_agent_id)
        .maybeSingle<CustomAgent>()
    : { data: null };

  const template = templateForAgent(agent, custom);
  if (!template) notFound();

  const [{ data: generations }, { data: notes }, { data: revisions }] =
    await Promise.all([
      supabase
        .from("generations")
        .select("*")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(30),
      // What it has worked out. RLS scopes both of these to the owner.
      supabase
        .from("agent_notes")
        .select("*")
        .eq("agent_id", agent.id)
        .order("observations", { ascending: false })
        .limit(40),
      supabase
        .from("agent_prompt_revisions")
        .select("*")
        .eq("agent_id", agent.id)
        .order("version", { ascending: false })
        .limit(10),
    ]);

  const name = displayName(agent.template_id, agent.name, template.name);
  const role = memberFor(agent.template_id)?.role;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-muted transition-colors hover:text-muted"
        >
          ← All agents
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <AgentAvatar
                name={name}
                seed={agent.template_id}
                size={44}
                commander={agent.template_id === "head-agent"}
              />
              <div>
                <h1 className="text-3xl font-extrabold leading-tight text-fg-strong">
                  {name}
                </h1>
                {role ? (
                  <p className="text-sm font-medium uppercase tracking-wide text-faint">
                    {role}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-[15px] text-muted">{template.description}</p>
          </div>

          {agent.status === "deployed" ? (
            <Badge tone={agent.paused ? "darkWarning" : "darkSuccess"}>
              {agent.paused ? "Stopped" : "Running"}
            </Badge>
          ) : null}
        </div>

        {/* Chat is always available. It used to be gated behind `deploy_url`,
            from when each customer hosted their own copy — so on the
            platform-hosted model the button existed for nobody, and "talk to
            any agent" was a promise with no door. The agent URL still shows
            when there is one, for the few who self-host. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/agents/${agent.id}/chat`}>
            <Button size="sm">
              <MessageSquare />
              Chat with {name}
            </Button>
          </Link>

          {agent.deploy_url ? (
            <a href={agent.deploy_url} target="_blank" rel="noreferrer">
              <Button variant="darkOutline" size="sm">
                <ExternalLink />
                Open agent URL
              </Button>
            </a>
          ) : null}
        </div>

        {agent.last_error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] p-4 text-sm leading-relaxed text-danger"
          >
            {agent.last_error}
          </p>
        ) : null}
      </header>

      {/* The verbs. Without these the page is a profile: it says an agent
          exists and gives no way to make it do anything. */}
      <AgentControls
        agentId={agent.id}
        agentName={name}
        standingJob={template.scheduledTask ?? null}
      />

      {/* The work first.
      
          This section used to be last, under the API-key form and the memory
          panel, and every "needs your approval" card on the board linked here —
          so pressing approve landed the founder on a settings page with the
          thing they came to approve three scrolls below. The order now matches
          why anyone opens this page: read what it made, then approve it, and
          only then change how it is set up. */}
      <section id="work" className="scroll-mt-6">
        <h2 className="text-xl font-bold text-fg-strong">What it made</h2>
        <p className="mt-1 text-sm text-muted">
          Newest first. Anything unapproved is waiting on you.
        </p>
        <div className="mt-5">
          <GenerationList generations={(generations ?? []) as Generation[]} />
        </div>
      </section>

      <AgentMemoryPanel
        agentName={name}
        notes={(notes ?? []) as AgentNote[]}
        revisions={(revisions ?? []) as PromptRevision[]}
      />

      <AgentConfigForm agent={agent} template={template} />
    </div>
  );
}
