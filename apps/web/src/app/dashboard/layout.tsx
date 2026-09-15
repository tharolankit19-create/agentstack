import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PaywallProvider } from "@/components/dashboard/paywall";
import { SupportWidget } from "@/components/support/support-widget";
import { FeedbackInvite } from "@/components/support/feedback-invite";
import { isEntitled } from "@/lib/plans";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireUser();
  const supabase = await createClient();
  const [{ data: creditRow }, { count: outputCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", session.userId)
      .maybeSingle<{ credit_balance: number }>(),
    supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId),
  ]);
  const balance = creditRow?.credit_balance ?? 0;

  return (
    <PaywallProvider isPaid={isEntitled(session.profile)}>
      <div className="kryx-dashboard-shell min-h-dvh bg-bg text-fg">
        <MobileNav email={session.email} plan={session.profile.plan} />
        <div className="flex min-h-dvh w-full">
          <Sidebar
            email={session.email}
            plan={session.profile.plan}
            balance={balance}
          />
          <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
        </div>
        <SupportWidget firstName={session.profile.full_name?.split(" ")[0] ?? null} />
        <FeedbackInvite accountCreatedAt={session.profile.created_at} outputCount={outputCount ?? 0} />
      </div>
    </PaywallProvider>
  );
}
