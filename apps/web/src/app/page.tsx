import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { TheArmy } from "@/components/landing/the-army";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

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

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main>
        <Hero />
        <TheArmy />
        {/* What the founder actually has to do, and when results land. */}
        <HowItWorks />
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
