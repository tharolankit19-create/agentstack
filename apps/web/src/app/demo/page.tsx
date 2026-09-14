import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { DemoConsole } from "@/components/landing/demo-console";
import { HEAD_AGENT } from "@/lib/army";
import { DEMO_COMPANY } from "@/lib/demo-data";

export const metadata = {
  title: "Interactive Demo — KryxAI",
  description: "Try Mission Control, the agent room and the lead pipeline without creating an account.",
};

export default function DemoPage() {
  return (
    <>
      <Header signedIn={false} />
      <main className="px-5 pb-16 pt-28 sm:pb-20 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="kryx-kicker">Demo mode</p>
              <h1 className="mt-2 text-[38px] font-bold leading-[1.02] tracking-[-0.04em] text-fg-strong sm:text-[52px]">
                Run the product before signup.
              </h1>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-muted">
                A worked day for {DEMO_COMPANY.name}, an invented company. Approve work, talk in the room and inspect the lead pipeline. Nothing here is real customer data.
              </p>
            </div>

            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 px-5 text-sm">
              Start with 100 credits <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-8">
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>
        </div>
      </main>
    </>
  );
}
