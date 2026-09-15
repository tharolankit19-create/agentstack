import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI Competitor Research Agent",
  description: "Monitor competitor pages, market moves and current customer signals with a research agent that returns evidence instead of generic competitor summaries.",
  alternates: { canonical: "/ai-competitor-research-agent" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI competitor research agent"
    title="Competitor research that starts with live evidence."
    intro="Kryx's research specialist is built to read current pages and market signals before it writes a conclusion, so a founder can react to what changed rather than to a generic competitor template."
    problems={[
      "Checking the same competitor pricing and positioning pages by hand",
      "Missing changes because nobody looked this week",
      "Receiving summaries that do not name the evidence behind the claim",
      "Collecting research without deciding whether it matters",
      "Turning every small competitor change into founder noise",
    ]}
    how={[
      "Start from the competitor, market or customer question that matters.",
      "Pull only the live pages and external signals needed to answer it.",
      "Separate observed facts from interpretation and avoid inventing missing data.",
      "Escalate only the moves that create a real opportunity, risk or decision.",
    ]}
    outcome="A short evidence-backed competitor brief with the current signal, why it matters and what — if anything — the founder should do next."
  />;
}
