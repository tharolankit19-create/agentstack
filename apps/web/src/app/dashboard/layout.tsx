import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PaywallProvider } from "@/components/dashboard/paywall";
import { SupportWidget } from "@/components/support/support-widget";
import { isEntitled } from "@/lib/plans";
import type { Agent } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireUser();
  const supabase = await createClient();
  const [{ data: agents }, { data: creditRow }] = await Promise.all([
    supabase.from("agents").select("id, name, template_id, status, paused").order("created_at", { ascending: true }),
    supabase.from("profiles").select("credit_balance").eq("id", session.userId).maybeSingle<{ credit_balance: number }>(),
  ]);
  const balance = creditRow?.credit_balance ?? 0;

  return (
    <PaywallProvider isPaid={isEntitled(session.profile)}>
      <div className="kryx-dashboard-shell min-h-dvh bg-bg text-fg">
        <MobileNav email={session.email} plan={session.profile.plan} />
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
          <Sidebar
            agents={(agents ?? []) as Pick<Agent, "id" | "name" | "template_id" | "status" | "paused">[]}
            email={session.email}
            plan={session.profile.plan}
            balance={balance}
          />
          <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
        </div>
        <SupportWidget firstName={session.profile.full_name?.split(" ")[0] ?? null} />
      </div>
    </PaywallProvider>
  );
}
