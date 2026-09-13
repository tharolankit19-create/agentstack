import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI SEO Agent for SaaS Founders",
  description: "KryxAI researches search demand, prepares evidence-backed SEO pages and keeps SEO work connected to real product and traffic data.",
  alternates: { canonical: "/ai-seo-agent" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI SEO agent"
    title="SEO research and page work without the content-farm loop."
    intro="KryxAI's search agent is designed to find useful search opportunities, separate intent, prepare pages from real product evidence and report what actually earns impressions and traffic."
    problems={[
      "Choosing keywords without knowing which intent is worth owning",
      "Publishing near-duplicate programmatic pages",
      "Forgetting internal links, canonicals and technical search basics",
      "Writing generic pages with no first-party evidence",
      "Losing track of which pages actually create qualified traffic",
    ]}
    how={[
      "Research demand, competitors and current search results before drafting.",
      "Map each page to one distinct search job and conversion job.",
      "Use product facts, customer language and analytics instead of invented proof.",
      "When a GitHub repository is connected, prepare SEO-only code changes for approved publishing.",
    ]}
    outcome="Fewer pages, stronger intent coverage and a measurable loop from search research to page publication to impressions, clicks and signups."
  />;
}
