import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";

export function Hero() {
  return (
    <section className="kryx-hero relative overflow-hidden border-b border-line px-4 pt-20 sm:px-5 sm:pt-24">
      <div className="kryx-signal-halo" aria-hidden />
      <div className="relative mx-auto flex min-h-[72svh] w-full max-w-[1180px] items-center justify-center py-12 sm:min-h-[76svh] sm:py-16">
        <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
          <p className="microlabel">AI marketing team for founders</p>

          <h1 className="mx-auto mt-5 max-w-5xl text-[54px] font-extrabold leading-[.93] tracking-[-.07em] text-fg-strong sm:text-[76px] lg:text-[94px]">
            Give Kryx the goal.
            <span className="block">It does the marketing work.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[690px] text-[16px] leading-7 text-muted sm:text-[18px] sm:leading-8">
            Research, leads, content and distribution across the web and the apps
            you are already signed into. Kryx uses the right device, keeps
            evidence, and asks before consequential actions.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/download"
              className="kryx-button kryx-button-primary h-14 min-w-[190px] px-8 text-[15px] sm:h-[58px] sm:text-base"
            >
              <Download className="size-[18px]" />
              Download Kryx
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex h-14 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-line bg-surface px-6 text-[15px] font-extrabold text-fg-strong transition hover:bg-surface-2 sm:h-[58px]"
            >
              Open web app <ArrowRight className="size-4" />
            </Link>
          </div>

          <p className="mt-5 text-xs font-semibold text-faint sm:text-sm">
            Same Kryx account on web, Mac and Android tablet · pay as you go
          </p>
        </div>
      </div>
    </section>
  );
}
