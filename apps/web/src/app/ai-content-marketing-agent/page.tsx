import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI Content Marketing Agent for SaaS",
  description: "Create SaaS content from current customer, competitor and market evidence while keeping the founder's voice and final publishing approval.",
  alternates: { canonical: "/ai-content-marketing-agent" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI content marketing agent"
    title="Content that starts from evidence, not a blank prompt."
    intro="Kryx's content specialist uses the founder's product context and current market signal before drafting. It is designed to produce something worth editing or approving, not generic posts at maximum volume."
    problems={[
      "Starting every post from an empty prompt",
      "Writing from stale model memory instead of what customers discuss now",
      "Using one generic format across X, LinkedIn, newsletters and long-form content",
      "Losing the founder's real claims and examples during rewriting",
      "Publishing automatically when a human should make the final call",
    ]}
    how={[
      "Pull the product, audience and current topic context first.",
      "Use live research only when it materially improves the draft.",
      "Write for the requested channel and preserve concrete founder evidence.",
      "Put publication behind founder approval rather than silently sending it.",
    ]}
    outcome="Fewer generic drafts, faster iteration and a visible trail from current evidence to the content the founder actually chooses to publish."
  />;
}
