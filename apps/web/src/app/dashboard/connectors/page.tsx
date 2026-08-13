import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectorStates } from "@/lib/connectors";
import { canOperate } from "@/lib/plans";
import { ConnectorsPanel } from "@/components/dashboard/connectors-panel";

export const dynamic = "force-dynamic";

/**
 * Connectors — the founder's own keys to the outside world.
 *
 * One page, one paste per tool. Firecrawl and X make the research squad
 * actually look at the world; Apollo and Resend are the outreach squad's hands,
 * handed to those agents the next time they deploy. Everything here is optional
 * — the army runs without any of it — and everything is encrypted the moment it
 * leaves this form.
 */
export default async function ConnectorsPage() {
  const session = await requireUser("/dashboard/connectors");
  const admin = createAdminClient();
  const connectors = await connectorStates(admin, session.userId);

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Connectors</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Plug in a few of your own keys and your army reaches further. All of
          it is optional, all of it is encrypted, and you paste each one once —
          it wires into every agent that needs it.
        </p>
      </header>

      <ConnectorsPanel
        initial={connectors}
        canOperate={canOperate(session.profile)}
      />
    </div>
  );
}
