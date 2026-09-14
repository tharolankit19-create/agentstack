import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { COST } from "@/lib/credits-public";

export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="border-b border-line px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Pricing</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-.045em] text-fg-strong sm:text-6xl">$0/month. Pay only when the team works.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">Chat with Kryx, plan work, review results and manage your team for free. Specialist work uses credits. 100 credits = $1. Purchased credits never expire.</p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <Reveal delay={60}>
            <div className="kryx-panel h-full rounded-[28px] border border-line bg-surface p-7 sm:p-8">
              <p className="text-sm font-bold text-muted">Start free</p>
              <div className="mt-3 flex items-end gap-2"><span className="text-6xl font-extrabold tracking-[-.06em] text-fg-strong">$0</span><span className="pb-2 text-sm font-semibold text-muted">monthly</span></div>
              <p className="mt-4 text-sm leading-relaxed text-muted">Every new founder gets 100 credits — $1 of real work — with no card required.</p>
              <ul className="mt-6 space-y-3 text-sm text-fg">
                {["Kryx chat & planning included", "All specialist agents included", "No seat fee", "No agent fee", "No expiring credits", "No surprise overage bill"].map((item) => <li key={item} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-[#35d6a6]/12 text-[#07966f]"><Check className="size-3.5" /></span>{item}</li>)}
              </ul>
              <Link href={signedIn ? "/dashboard/usage" : "/login?mode=signup"} className="kryx-primary mt-8 inline-flex h-13 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold">{signedIn ? "Add credits" : "Hire Kryx for free"}</Link>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="h-full overflow-hidden rounded-[28px] border border-line bg-surface">
              <div className="border-b border-line px-6 py-5 sm:px-8"><p className="text-sm font-extrabold text-fg-strong">What work costs</p><p className="mt-1 text-xs text-muted">Simple, visible units. No token math.</p></div>
              <div className="divide-y divide-line">
                {[
                  ["Draft / rewrite", COST.draft, "quick specialist work"],
                  ["Web search", COST.web_search, "per search"],
                  ["Social / trend scan", COST.social_scan, "per scan"],
                  ["Rank or review check", COST.rank_check, "per check"],
                  ["Email lookup", COST.email_lookup, "per person"],
                  ["Qualified lead search", COST.lead_search, "per search"],
                  ["Morning / evening brief", COST.briefing, "per brief"],
                ].map(([label, credits, note]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-5 px-6 py-4 sm:px-8">
                    <div><p className="text-sm font-semibold text-fg-strong">{String(label)}</p><p className="mt-0.5 text-xs text-muted">{String(note)}</p></div>
                    <div className="text-right"><p className="text-lg font-extrabold text-fg-strong">{String(credits)}</p><p className="text-[11px] text-muted">credits</p></div>
                  </div>
                ))}
              </div>
              <div className="bg-[#4f6bff]/7 px-6 py-5 text-sm leading-relaxed text-muted sm:px-8">Top up from <strong className="text-fg-strong">$5</strong>. Your balance pauses work before it can go negative.</div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
