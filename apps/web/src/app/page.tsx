import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { VsVibecoding } from "@/components/landing/vs-vibecoding";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

/**
 * The landing page.
 *
 * It used to have thirteen sections. Thirteen sections is not a landing page,
 * it is an admission that no single one of them was convincing — and stacked
 * alternating bands of feature copy are the exact house style of every AI
 * product launched this year, which is its own kind of tell.
 *
 * Five now, and the first one is the whole argument: here is everything you
 * pay for, here is what stops, add it up yourself. What follows only handles
 * the three objections that survive the list — can't I build this myself,
 * how does it actually work, what does it cost.
 */
export default async function LandingPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main>
        <Hero />
        <VsVibecoding />
        <HowItWorks />
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
