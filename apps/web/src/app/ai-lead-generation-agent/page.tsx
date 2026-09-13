import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI Lead Generation Agent for SaaS",
  description: "KryxAI researches, qualifies and prepares personalized SaaS leads while keeping outbound sending approval-gated.",
  alternates: { canonical: "/ai-lead-generation-agent" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI lead generation agent"
    title="Find the right leads before writing another cold email."
    intro="KryxAI's pipeline agents separate finding, qualifying and writing so outreach starts from a real customer fit and a current reason to contact them."
    problems={[
      "Scraping large lists that do not match the actual ICP",
      "Writing outreach before verifying the person or company",
      "Using fake personalization with no timely trigger",
      "Losing context between research and the final email",
      "Sending consequential outreach without founder review",
    ]}
    how={[
      "Research accounts and people against the founder's actual ICP.",
      "Keep evidence and a timely trigger with each qualified lead.",
      "Write a short message from that evidence instead of a generic sequence.",
      "Put the final send behind a clear approval action in Mission Control.",
    ]}
    outcome="A smaller pipeline with better reasons to reach out, visible evidence for every lead and no surprise sending."
  />;
}
