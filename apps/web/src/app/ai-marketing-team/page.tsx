import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI Marketing Team for Startups",
  description: "KryxAI coordinates research, content, SEO, CRO and pipeline agents into one simple AI marketing team for startup founders.",
  alternates: { canonical: "/ai-marketing-team" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI marketing team"
    title="One AI marketing team. One founder inbox."
    intro="KryxAI is built for founders who do not want to manage a maze of bots. Kryx coordinates specialist agents and turns their work into short decisions, drafts and approvals."
    problems={[
      "Jumping between separate research, content, SEO and analytics tools",
      "Repeating product context to every AI conversation",
      "Reading long reports when one decision would be enough",
      "Manually checking whether scheduled work happened",
      "Not knowing what needs approval and what can safely run automatically",
    ]}
    how={[
      "Kryx keeps the founder context and routes each task to the right specialist.",
      "Specialists work in the background and return structured evidence and outputs.",
      "Mission Control separates work in flight, queued, done and waiting on the founder.",
      "Morning, evening and urgent briefs surface only what changed and what matters next.",
    ]}
    outcome="The experience should feel like checking in with a small marketing team, not operating an AI workflow builder."
  />;
}
