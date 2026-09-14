import { FloatingHeader } from "@/components/landing/floating-header";
import { Hero } from "@/components/landing/hero";
import { AgentFlow } from "@/components/landing/agent-flow";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  return (
    <>
      <FloatingHeader signedIn={Boolean(session)} />
      <main>
        <Hero />
        <AgentFlow />
        <HowItWorks />
        <Pricing signedIn={Boolean(session)} compact />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
