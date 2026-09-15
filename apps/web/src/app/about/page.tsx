import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { SITE, twitterUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Why Ankit Tharol is building KryxAI, and the product rules behind it.",
};

const RULES = [
  ["Show the work", "A claim should open into a source, draft, lead or saved result."],
  ["Keep the founder in control", "External and consequential actions wait for approval."],
  ["Say when nothing was found", "A useful system reports a quiet search instead of manufacturing activity."],
  ["Charge for completed work", "The current product has no monthly seat fee. Specialist actions use visible credits."],
] as const;

export default async function AboutPage() {
  const session = await getSession().catch(() => null);
  const twitter = twitterUrl();
  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main className="px-5 pb-20 pt-28 sm:pt-36">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 border-b border-line pb-14 lg:grid-cols-[.72fr_1.28fr]">
            <div><p className="microlabel">About Kryx</p><h1 className="mt-4 text-5xl sm:text-7xl">Built for founders who still do the marketing.</h1></div>
            <div className="lg:pt-8">
              <p className="max-w-2xl font-serif text-2xl italic leading-9 text-fg">“AI can write a draft. The harder problem is deciding what needs doing, finding current evidence, handing each part to the right process and bringing back a result the founder can approve.”</p>
              <p className="mt-7 font-bold text-fg-strong">{SITE.founder}, founder</p>
              {twitter ? <a href={twitter} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-muted underline underline-offset-4">@{SITE.twitterHandle.replace(/^@/, "")}</a> : null}
            </div>
          </div>

          <section className="grid gap-10 border-b border-line py-14 lg:grid-cols-[.72fr_1.28fr]">
            <div><h2 className="text-3xl">The product rules</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted">These are constraints on the product, not marketing promises.</p></div>
            <div className="border-t border-line">{RULES.map(([title, body]) => <div key={title} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[190px_1fr]"><h3 className="text-base">{title}</h3><p className="text-sm leading-6 text-muted">{body}</p></div>)}</div>
          </section>

          <section className="grid gap-10 py-14 lg:grid-cols-[.72fr_1.28fr]">
            <div><h2 className="text-3xl">Where it stands</h2></div>
            <div><p className="max-w-2xl text-[16px] leading-7 text-muted">Kryx is an early product built in public. The interactive demo uses declared sample data. We will add named customer evidence only when a customer has agreed to it. Until then, judge the product by what you can inspect.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/demo" className="kryx-button kryx-button-secondary h-11 px-4 text-sm">Use the demo</Link><Link href="/login?mode=signup" className="kryx-button kryx-button-primary h-11 px-4 text-sm">Start free <ArrowRight className="size-4" /></Link></div></div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
