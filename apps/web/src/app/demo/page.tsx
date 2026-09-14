import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { DemoConsole } from "@/components/landing/demo-console";
import { HEAD_AGENT } from "@/lib/army";
import { DEMO_COMPANY } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Interactive Demo",
  description: "Try the KryxAI product interface with a worked example loaded. No signup required.",
};

export default function DemoPage() {
  return (
    <>
      <Header signedIn={false} />
      <main className="px-5 pb-16 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Interactive demo</p>
              <h1 className="mt-3 text-[38px] font-extrabold leading-[1.02] tracking-[-0.04em] text-fg-strong sm:text-[52px]">Run a Tuesday before you sign up.</h1>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">A worked example for {DEMO_COMPANY.name}. The company and data are fictional — click through Mission Control, Room and Leads to see how the product behaves.</p>
            </div>
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 px-6 text-sm">
              Start with $1 free <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10"><DemoConsole headName={HEAD_AGENT.defaultName} /></div>
          <p className="mt-8 text-center text-[14px] text-muted">Your workspace uses your company, your competitors and your connected data. <Link href="/login?mode=signup" className="font-semibold text-fg-strong underline">Set it up</Link>.</p>
        </div>
      </main>
    </>
  );
}
