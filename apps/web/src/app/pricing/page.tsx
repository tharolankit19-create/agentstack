import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/landing/header";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { isEntitled } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };

/**
 * The wall.
 *
 * Someone who has signed in but not paid lands here when they try the
 * dashboard. There is no preview and no read-only mode behind it — signups do
 * not pay the bills.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [session, params] = await Promise.all([
    getSession().catch(() => null),
    searchParams,
  ]);

  if (session && isEntitled(session.profile)) redirect("/dashboard");

  const blocked = params.from === "dashboard";

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main>
        {blocked ? (
          <div className="border-b border-line bg-[var(--accent-wash)] px-5 py-10">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-2xl font-extrabold sm:text-3xl">
                Explore free. Start a trial when you are ready.
              </h1>
              <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-muted">
                Pick a plan and your agents are live in 90 seconds. Cancel in
                one click — you keep everything they made.{" "}
                <Link href="/#agents" className="font-semibold underline">
                  See all the agents
                </Link>{" "}
                first if you want.
              </p>
            </div>
          </div>
        ) : null}

        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
