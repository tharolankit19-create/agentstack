import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "lucide-react";

const RECEIPTS = [
  ["06:52", "Competitor trial change found", "Pricing page changed Tuesday · source saved", "Evidence attached"],
  ["07:01", "Homepage problem isolated", "Answer appears four paragraphs too late", "Rewrite ready"],
  ["07:04", "18 prospects kept from 41 found", "Non-buyers removed before outreach", "List ready"],
] as const;

export function Hero() {
  return (
    <section className="grid-field border-b border-line px-5 pb-14 pt-28 sm:pb-20 sm:pt-36">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,.86fr)] lg:items-center">
        <div>
          <h1 className="max-w-[780px] text-[46px] leading-[.94] tracking-[-.055em] text-fg-strong sm:text-[68px] lg:text-[82px]">
            Give Kryx the goal.
            <span className="block font-serif font-normal italic tracking-[-.035em] text-muted">Come back to finished work.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[17px] leading-7 text-muted sm:text-[19px] sm:leading-8">
            Research, leads, SEO, content and conversion work in one workspace. Kryx uses live tools, saves the evidence and waits for your approval before anything consequential leaves it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-12 px-5 text-sm">Start with 100 credits <ArrowRight className="size-4" /></Link>
            <Link href="#demo" className="kryx-button kryx-button-secondary h-12 px-5 text-sm">Use the product demo</Link>
          </div>
          <p className="mt-4 text-[13px] text-muted">No card. No monthly seat fee. 100 credits = $1.</p>
        </div>

        <div className="border-y border-line bg-surface sm:border sm:p-2">
          <div className="bg-bg-deep/55">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <div><p className="text-sm font-bold text-fg-strong">Morning brief</p><p className="text-xs text-muted">Sample workspace · today</p></div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-money"><span className="size-1.5 rounded-full bg-money" /> 3 ready</span>
            </div>
            <div className="divide-y divide-line">
              {RECEIPTS.map(([time, title, detail, status]) => (
                <div key={time} className="grid grid-cols-[46px_1fr] gap-2 px-4 py-4 sm:px-5">
                  <time className="tnum pt-0.5 text-[11px] text-faint">{time}</time>
                  <div>
                    <p className="text-sm font-semibold text-fg-strong">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg"><Check className="size-3 text-money" /> {status}{status === "Evidence attached" ? <ExternalLink className="ml-1 size-3 text-faint" /> : null}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line bg-surface px-4 py-3 sm:px-5"><p className="text-xs text-muted">2 decisions need you</p><span className="text-xs font-bold text-fg-strong">Review work →</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
