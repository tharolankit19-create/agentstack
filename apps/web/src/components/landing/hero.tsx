import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="kryx-hero relative min-h-[100svh] overflow-hidden border-b border-line px-5">
      <div className="kryx-signal-halo" aria-hidden />
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col items-center justify-center pb-16 pt-28 text-center sm:pt-32">
        <h1 className="mx-auto max-w-5xl text-[52px] font-extrabold leading-[.92] tracking-[-.067em] text-fg-strong sm:text-[76px] lg:text-[92px]">
          Kryx, your AI head of marketing.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-7 text-muted sm:text-[19px] sm:leading-8">
          Give Kryx one growth goal. It picks the right specialist, checks live
          data, and comes back when you need to decide.
        </p>

        <Link
          href="/login?mode=signup"
          className="kryx-button kryx-button-primary mt-8 h-12 px-6 text-sm"
        >
          Give Kryx a goal <ArrowRight className="size-4" />
        </Link>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-wash px-3 py-1.5 text-[11px] font-extrabold tracking-[.01em] text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          100 starter credits · no card
        </div>
      </div>
    </section>
  );
}
