import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { AgentWorkflow } from "@/components/landing/agent-workflow";
import { Problem } from "@/components/landing/problem";
import { Library } from "@/components/landing/library";
import { CustomBuilder } from "@/components/landing/custom-builder";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Roadmap } from "@/components/landing/roadmap";
import { Comparison } from "@/components/landing/comparison";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

/**
 * The landing page.
 *
 * Order matters: prove the number, name the pain, show the whole library,
 * answer "but my tool isn't on it", then price it against the anchor. Each
 * section says one thing. Anything that said a second thing got cut.
 */
export default async function LandingPage() {
  const session = await getSession().catch(() => null);

  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main>
        <Hero />
        <AgentWorkflow />
        <Problem />
        <Library />
        <CustomBuilder />
        <HowItWorks />
        <Roadmap />
        <Comparison />
        <Testimonials />
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
