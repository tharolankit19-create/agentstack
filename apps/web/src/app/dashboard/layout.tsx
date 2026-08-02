import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireOnboardedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { PaywallProvider } from "@/components/dashboard/paywall";
import { SupportWidget } from "@/components/support/support-widget";
import { hasPaid } from "@/lib/plans";
import type { Agent } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Middleware already bounced anyone without a session. This re-checks the
  // plan against the database, because the cookie proves identity, not payment.
  const session = await requireOnboardedUser();

  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, template_id, status, paused")
    .order("created_at", { ascending: true });

  return (
    <PaywallProvider isPaid={hasPaid(session.profile.plan)}>
    <div className="surface-dark min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <Sidebar
          agents={(agents ?? []) as Pick<
            Agent,
            "id" | "name" | "template_id" | "status" | "paused"
          >[]}
          email={session.email}
          plan={session.profile.plan}
          quota={session.profile.agent_quota}
        />
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
      <SupportWidget firstName={session.profile.full_name?.split(" ")[0] ?? null} />
    </div>
    </PaywallProvider>
  );
}
