import type { Metadata } from "next";
import { Header } from "@/components/landing/header";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Pricing",
  description: "$0/month. Start with $1 of work and buy non-expiring credits only when KryxAI's specialist agents work.",
};

export default async function PricingPage() {
  const session = await getSession().catch(() => null);
  return (
    <>
      <Header signedIn={Boolean(session)} />
      <main className="pt-16">
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
