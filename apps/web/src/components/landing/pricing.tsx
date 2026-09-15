import Link from "next/link";
import { Check } from "lucide-react";
import { COST } from "@/lib/credits-public";

const COSTS = [
  ["Draft or rewrite", COST.draft, "one finished draft"],
  ["Page read", COST.page_read, "one page fetched"],
  ["Web search", COST.web_search, "one live search"],
  ["Social scan", COST.social_scan, "one topic scan"],
  ["Review check", COST.review_check, "one review lookup"],
  ["Email lookup", COST.email_lookup, "one person"],
  ["Rank check", COST.rank_check, "one search check"],
  ["Qualified lead search", COST.lead_search, "one filtered search"],
  ["Morning or evening brief", COST.briefing, "one saved brief"],
] as const;

export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="border-b border-line px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="microlabel">Pricing</p>
            <h1 className="mt-4 text-5xl sm:text-7xl">No subscription.</h1>
            <p className="mt-5 max-w-md text-[17px] leading-7 text-muted">Buy credits when Kryx needs specialist work. Planning, chat and review have no seat fee. 100 credits = $1.</p>
            <ul className="mt-7 space-y-3 text-sm text-fg">
              {["100 credits when you sign up", "No card to start", "Top up from $5", "Purchased credits do not expire", "Work pauses before the balance goes negative"].map(item => <li key={item} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-money" />{item}</li>)}
            </ul>
            <Link href={signedIn ? "/dashboard/usage" : "/login?mode=signup"} className="kryx-button kryx-button-primary mt-8 h-12 px-5 text-sm">{signedIn ? "Add credits" : "Run your first mission"}</Link>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4 border-b border-line pb-4"><div><h2 className="text-2xl">Every current cost</h2><p className="mt-1 text-sm text-muted">No token math or hidden agent fee.</p></div><p className="tnum text-xs text-muted">100 cr = $1</p></div>
            <div className="divide-y divide-line">
              {COSTS.map(([label, credits, unit]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-5 py-4"><div><p className="text-sm font-semibold text-fg-strong">{label}</p><p className="mt-0.5 text-xs text-muted">{unit}</p></div><p className="tnum text-sm font-semibold text-fg-strong">{credits} cr</p></div>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
