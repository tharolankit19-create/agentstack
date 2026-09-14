import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { DemoConsole } from "@/components/landing/demo-console";
import { HEAD_AGENT } from "@/lib/army";

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden px-5 pb-14 pt-28 sm:pb-18 sm:pt-32">
      <div className="kryx-aurora" aria-hidden />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="kryx-badge mx-auto w-fit">
            <span className="size-1.5 rounded-full bg-live shadow-[0_0_14px_var(--live)]" />
            $0/month · $1 of work included
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-[44px] font-bold leading-[.96] tracking-[-.055em] text-fg-strong sm:text-[62px] lg:text-[76px]">
            Your AI Head of Marketing.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px]">
            Give Kryx the goal. It coordinates research, content, SEO, conversion and pipeline — then brings you only the decisions that need a founder.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 min-w-[190px] px-5 text-[14px]">
              Start with $1 free <ArrowRight className="size-4" />
            </Link>
            <Link href="#demo" className="kryx-button kryx-button-secondary h-12 min-w-[150px] px-5 text-[14px]">Try the demo</Link>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-muted">
            <span className="flex items-center gap-1.5"><Check className="size-3 text-live"/>No card</span>
            <span className="flex items-center gap-1.5"><Check className="size-3 text-live"/>No seat fee</span>
            <span className="flex items-center gap-1.5"><Check className="size-3 text-live"/>Credits never expire</span>
          </div>
        </div>

        <div id="demo" className="kryx-product-frame mx-auto mt-11 max-w-6xl scroll-mt-24">
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold text-muted">
            <span>Interactive product demo</span>
            <Link href="/demo" className="text-fg-strong hover:underline">Open full demo →</Link>
          </div>
          <DemoConsole headName={HEAD_AGENT.defaultName} />
        </div>
      </div>
    </section>
  );
}
