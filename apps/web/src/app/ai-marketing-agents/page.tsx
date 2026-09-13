import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI Marketing Agents for Founders",
  description: "Use a coordinated AI marketing agent team for research, content, SEO, conversion and lead generation without manually orchestrating every task.",
  alternates: { canonical: "/ai-marketing-agents" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI marketing agents"
    title="An AI marketing team that keeps working after you close the tab."
    intro="KryxAI gives founders one lead agent, Kryx, plus specialist agents for research, content, SEO, conversion and pipeline. The point is not more chatbots. It is less coordination work."
    problems={[
      "Researching competitors, customers and trends every day",
      "Turning evidence into platform-specific content",
      "Finding SEO opportunities and maintaining search pages",
      "Checking conversion bottlenecks and deciding what to test next",
      "Finding qualified leads and preparing outreach",
    ]}
    how={[
      "Kryx reads the founder goal and current product context.",
      "The smallest useful set of specialist agents is delegated work.",
      "Agents return evidence, drafts and decisions to Kryx instead of flooding the founder.",
      "Kryx sends a short brief and asks for approval only when an action is consequential.",
    ]}
    outcome="A founder should be able to open KryxAI and see what changed, what the team completed, what is blocked, and the one action that matters next."
  />;
}
