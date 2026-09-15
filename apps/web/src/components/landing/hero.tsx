import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden px-5 pb-12 pt-28 sm:pb-14 sm:pt-32">
      <div className="kryx-aurora" aria-hidden />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="kryx-badge mx-auto w-fit">
            <span className="size-1.5 rounded-full bg-live shadow-[0_0_14px_var(--live)]" />
            100 free credits · no card
          </div>

          <h1 className="mx-auto mt-6 max-w-4xl text-[44px] font-bold leading-[.96] tracking-[-.055em] text-fg-strong sm:text-[62px] lg:text-[76px]">
            Your AI Head of Marketing.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px]">
            Give Kryx one outcome. It delegates research, SEO, content, conversion and pipeline work, then brings back only the decisions that need you.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 min-w-[190px] px-5 text-[14px]">
              Hire Kryx free <ArrowRight className="size-4" />
            </Link>
            <Link href="#demo" className="kryx-button kryx-button-secondary h-12 min-w-[160px] px-5 text-[14px]">
              Try the live demo
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] font-medium text-muted">
            <span>No card</span><span>•</span><span>No seat fee</span><span>•</span><span>Credits never expire</span>
          </div>
        </div>
      </div>
    </section>
  );
}
