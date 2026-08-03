import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canBuildCustomAgents } from "@/lib/plans";
import { CustomAgentBuilder } from "@/components/dashboard/custom-agent-builder";
import type { CustomAgent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CustomAgentPage() {
  const session = await requireOnboardedUser("/dashboard/custom");

  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_agents")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-muted transition-colors hover:text-muted"
        >
          ← All agents
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold text-fg-strong">
          Replace a tool we have not built yet
        </h1>
        <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">
          Paste the URL of something you pay for. We read its site and its API
          docs, work out the job it does, and build you an agent that does it.
        </p>
      </header>

      <CustomAgentBuilder
        existing={(data ?? []) as CustomAgent[]}
        canBuild={canBuildCustomAgents(session.profile.plan)}
      />
    </div>
  );
}
