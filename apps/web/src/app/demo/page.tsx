import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { DemoConsole } from "@/components/landing/demo-console";
import { HEAD_AGENT } from "@/lib/army";
import { DEMO_COMPANY } from "@/lib/demo-data";

export const metadata = {
  title: "Try it — Marketing Agents Army",
  description:
    "Open the real interface with a worked example loaded. No signup, no email.",
};

/**
 * The product, before signup.
 *
 * A landing page can only assert; this lets a stranger open Mission Control,
 * the room and the lead pipeline and see what a working Tuesday looks like
 * before deciding whether to hand over an email address. It is the same layout
 * the customer gets, filled with a fixed example.
 *
 * Labelled as a sample in the frame rather than in a dismissible banner. A
 * visitor who forgets they are in a demo and signs up expecting those exact
 * leads has been misled, and a notice they can close is a notice designed to be
 * closed.
 */
export default function DemoPage() {
  return (
    <>
      <Header signedIn={false} />

      <main className="px-5 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-[38px] leading-[1.02] tracking-[-0.03em] sm:text-[52px]">
                This is the whole thing.
              </h1>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
                A worked Tuesday for {DEMO_COMPANY.name}. An invented company,
                so nothing here is anyone&rsquo;s real data — click through all
                of it. Nothing asks for an email.
              </p>
            </div>

            <Link
              href="/login?mode=signup"
              className="group inline-flex h-13 items-center gap-2.5 rounded-lg bg-accent px-7 py-3.5 text-[16px] font-semibold text-accent-fg transition-transform hover:scale-[1.02]"
            >
              Start yours — 500 credits free
              <ArrowRight className="size-4.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-10">
            <DemoConsole headName={HEAD_AGENT.defaultName} />
          </div>

          <p className="mt-8 text-center text-[14px] text-muted">
            Yours reports your numbers, your competitors and your leads.{" "}
            <Link href="/login?mode=signup" className="font-semibold text-fg underline">
              Set it up in two minutes
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
