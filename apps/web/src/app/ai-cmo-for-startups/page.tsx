import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "AI CMO for Startups",
  description: "KryxAI acts as an AI Head of Marketing for startup founders, coordinating research, SEO, content, conversion and pipeline work from one command center.",
  alternates: { canonical: "/ai-cmo-for-startups" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="AI CMO for startups"
    title="A marketing operator for founders who do not need another dashboard."
    intro="Kryx turns one founder goal into coordinated work across research, search, content, conversion and pipeline specialists. The value is the handoff between those jobs, not another chat window."
    problems={[
      "Deciding what the highest-leverage marketing move is this week",
      "Repeating product context across separate tools and contractors",
      "Researching before every content, SEO or outreach decision",
      "Losing track of work that is waiting for approval",
      "Spending founder time coordinating tasks instead of judging outcomes",
    ]}
    how={[
      "Give Kryx the outcome and the business context once.",
      "Kryx routes the work to the smallest useful set of specialists.",
      "Specialists pull live evidence when the task needs it and prepare the finished work.",
      "The founder sees only the decisions, drafts and consequential actions that need approval.",
    ]}
    outcome="A startup founder gets one place to see what changed, what was completed, what is scheduled and what genuinely needs their judgement next."
  />;
}
