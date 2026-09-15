import type { Metadata } from "next";
import { SeoSolutionPage } from "@/components/landing/seo-solution-page";

export const metadata: Metadata = {
  title: "SaaS Marketing Automation for Founders",
  description: "Automate recurring SaaS marketing research, SEO, content and pipeline tasks with scheduled specialist agents and a founder-controlled approval layer.",
  alternates: { canonical: "/saas-marketing-automation" },
};

export default function Page() {
  return <SeoSolutionPage
    eyebrow="SaaS marketing automation"
    title="Automate the recurring work, not the founder's judgement."
    intro="KryxAI lets founders schedule plain-language work for specialist agents — once, daily or hourly — while keeping public, outbound and other consequential actions under review."
    problems={[
      "Repeating the same research and reporting task every day",
      "Forgetting whether a scheduled marketing job actually ran",
      "Using brittle workflow builders for simple recurring instructions",
      "Automating publishing or outreach more aggressively than intended",
      "Managing separate schedules for research, SEO, content and pipeline work",
    ]}
    how={[
      "Choose the specialist that should own the task.",
      "Describe the outcome in plain language instead of building a workflow graph.",
      "Set the first run and choose once, daily or hourly.",
      "Review the task history, next run and any output or failure from one schedule view.",
    ]}
    outcome="Recurring marketing work keeps moving on a visible schedule while the founder retains control over the actions that can affect customers, spend or reputation."
  />;
}
