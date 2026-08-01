import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Agents } from "@/components/landing/agents";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Comparison } from "@/components/landing/comparison";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

/**
 * The landing page.
 *
 * Order matters: show it, then explain it, then prove it, then price it. Each
 * section says one thing. Anything that said a second thing got cut.
 */
export default async function LandingPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main>
        <Hero />
        <Problem />
        <Agents />
        <HowItWorks />
        <Comparison />
        <Testimonials />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
