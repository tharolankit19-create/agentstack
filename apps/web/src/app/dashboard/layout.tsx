import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PaywallProvider } from "@/components/dashboard/paywall";
import { SupportWidget } from "@/components/support/support-widget";
import { isEntitled } from "@/lib/plans";
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
  const session = await requireUser();
  if (!session.profile.onboarded_at && !session.profile.is_admin) redirect("/onboarding");

  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, template_id, status, paused")
    .order("created_at", { ascending: true });

  return (
    <PaywallProvider isPaid={isEntitled(session.profile)}>
    <div className="bg-bg text-fg min-h-dvh">
      {/* Phone-only. The sidebar below is desktop-only, so without this there
          is no way to reach Settings or Sign out on a phone. */}
      <MobileNav email={session.email} plan={session.profile.plan} />
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <Sidebar
          agents={(agents ?? []) as Pick<
            Agent,
            "id" | "name" | "template_id" | "status" | "paused"
          >[]}
          email={session.email}
          plan={session.profile.plan}
        />
        <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
      <SupportWidget firstName={session.profile.full_name?.split(" ")[0] ?? null} />
    </div>
    </PaywallProvider>
  );
}
