import { AnnounceBar } from "@/components/landing/announce-bar";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { ArmyFlow } from "@/components/landing/army-flow";
import { VsVibecoding } from "@/components/landing/vs-vibecoding";
import { Midline } from "@/components/landing/midline";
import { TheArmy } from "@/components/landing/the-army";
import { BRAND } from "@/lib/brand";
import { ShippingLog } from "@/components/landing/shipping-log";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { TEMPLATES } from "@/lib/templates";
import { countByVerdict, replaceableMonthlyTotal } from "@/lib/replaceability";

/**
 * The landing page.
 *
 * It used to have thirteen sections. Thirteen sections is not a landing page,
 * it is an admission that no single one of them was convincing.
 *
 * Six now, in the order the argument actually runs. The list makes the claim;
 * the running agent proves it is a real thing and not a spreadsheet; then the
 * three objections that survive both — can't I build this myself, how does it
 * work, what does it cost.
 */
export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  const counts = countByVerdict();

  return (
    <>
      <AnnounceBar
        agentCount={TEMPLATES.length}
        toolCount={counts.total}
        boardTotalUsd={replaceableMonthlyTotal()}
        priceUsd={PLANS.starter.priceUsd}
      />
      <Header signedIn={Boolean(session)} />
      <main>
        <Hero />
        {/* Everything above this is a claim. This is the only part of the page
            that shows the thing happening, which makes it the part that sells. */}
        <ArmyFlow />
        {/* Who you actually deal with: one commander, squads underneath. */}
        <TheArmy />
        <VsVibecoding />
        {/* One sentence between two structured blocks — the only thing that
            gets read at scroll speed. */}
        <Midline />
        <HowItWorks />
        {/* Why the price is a subscription and not a one-off: the library
            keeps growing, and what you buy keeps arriving. */}
        <ShippingLog />
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
