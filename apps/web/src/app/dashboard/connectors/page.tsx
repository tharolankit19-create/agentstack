import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectorStates } from "@/lib/connectors";
import { canOperate } from "@/lib/plans";
import { ConnectorsPanel } from "@/components/dashboard/connectors-panel";

export const dynamic = "force-dynamic";

/**
 * Connectors.
 *
 * The model, the data catalogue and the web reader all run on the platform's
 * keys, so this page is not a setup step and must not read like one. A new
 * founder arriving here should see that most of it is already handled — the
 * previous version greeted them with four required-looking API keys, which is
 * how a working product looks broken on the first screen they open.
 *
 * What genuinely belongs to the founder is the account work happens *under*:
 * the X account a post appears on, the inbox an email arrives from. Those are
 * theirs to connect, and nothing is done under their name until they do.
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
          Your army already runs on our keys — the ones marked{" "}
          <span className="font-semibold text-fg">included</span> need nothing
          from you. Connect your own accounts here when you want work to happen
          under them: your X to post from, your inbox to send from.
        </p>
      </header>

      <ConnectorsPanel
        initial={connectors}
        canOperate={canOperate(session.profile)}
      />
    </div>
  );
}
