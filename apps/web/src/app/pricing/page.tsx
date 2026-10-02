import type { Metadata } from "next";
import Link from "next/link";
import { Pricing } from "@/components/landing/pricing";
import { getSession } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pay for delegated work capacity. Visible credit costs and a budget for each goal.",
};
export default async function Page() {
  const session = await getSession().catch(() => null);
  return (
    <main>
      <nav className="op-landing flex items-center justify-between py-7">
        <Link href="/" className="font-semibold text-xl">
          KryxAI
        </Link>
        <Link href={session ? "/dashboard" : "/login"}>
          {session ? "Workspace" : "Sign in"}
        </Link>
      </nav>
      <Pricing signedIn={!!session} />
      <div className="op-landing py-12">
        <p className="text-muted">
          Your goals, tasks, skills and memory belong to one workspace. Current
          Dodo billing and balances remain compatible. Subscription packaging is
          configured from existing product mappings.
        </p>
        <Link className="inline-block mt-6" href="/dashboard">
          Give Kryx a goal →
        </Link>
      </div>
    </main>
  );
}
