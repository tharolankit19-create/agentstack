import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden border-b border-line px-4 pt-20 sm:px-5 sm:pt-24">
      <div className="kryx-signal-halo" aria-hidden />
      <div className="relative mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-6xl flex-col items-center justify-center pb-14 pt-6 text-center sm:pb-16">
        <h1 className="mx-auto max-w-4xl text-[48px] font-extrabold leading-[.95] tracking-[-.06em] text-fg-strong sm:text-[68px] lg:text-[82px]">
          Kryx.
          <span className="block">Your AI head of marketing.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
          Give Kryx the goal. Research, SEO, content, leads and outreach go to
          the right specialist. You only step in when something needs approval.
        </p>

        <Link
          href="/login?mode=signup"
          className="kryx-button kryx-button-primary mt-8 h-12 px-6 text-sm"
        >
          Give Kryx a goal <ArrowRight className="size-4" />
        </Link>

        <p className="mt-7 text-xs font-semibold text-faint">
          100 starter credits · no card · top up from $5
        </p>
      </div>
    </section>
  );
}
