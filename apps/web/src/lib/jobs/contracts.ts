import type { CompletionContract, TaskClass } from "./types";

export function classifyGoal(goal: string): TaskClass {
  if (/\b(find|discover|list)\b.*\b(leads?|founders?|prospects?)\b/i.test(goal)) return "LEAD_LIST";
  if (/\b(outreach|cold email|personalized message)\b/i.test(goal)) return "OUTREACH_DRAFTS";
  if (/\b(repurpose|linkedin post|x post|useful replies|turn .* into)\b/i.test(goal)) return "CONTENT_REPURPOSE";
  if (/\b(competitors?|pricing differences|positioning differences)\b/i.test(goal)) return "COMPETITOR_SCAN";
  return "RESEARCH_BRIEF";
}
export function completionContract(goal: string, context: Record<string, string>): CompletionContract {
  const taskClass = classifyGoal(goal);
  if (/\b(?:my|our)\s+(?:icp|ideal customer|target audience)/i.test(goal) && !context.icp && !context.audience) throw new Error("Which customer profile should I use? Include it in this job or save it in your workspace settings.");
  const match = /\b(\d{1,3})\s+(?:(?:qualified|unique|personalized|saas|b2b|saa?s)\s+){0,4}(?:leads?|founders?|prospects?|companies|competitors?|drafts?)\b/i.exec(goal);
  const count = Number(match?.[1] ?? (taskClass === "LEAD_LIST" || taskClass === "OUTREACH_DRAFTS" ? 20 : 3));
  if (count < 1 || count > 50) throw new Error("Verified jobs currently support 1–50 results per job.");
  const urls = [...new Set((goal.match(/https?:\/\/[^\s<>"')]+/g) ?? []).map(u => u.replace(/[.,;]+$/, "")))];
  const outreach = taskClass === "OUTREACH_DRAFTS" || /\b(outreach|personalized|personalised|drafts?)\b/i.test(goal);
  const inputs = { goal, count, icp: context.icp ?? context.audience ?? "", voice: context.voiceSample ?? context.brandVoice ?? "", outreach, urls, workspace: context };
  const predicates = [
    { id: "output_schema_valid", kind: "OUTPUT_SCHEMA_VALID" },
    { id: "artifact_exists", kind: "ARTIFACT_EXISTS" },
    { id: "sources_accessible", kind: "URL_RESOLVES" },
    { id: "claims_supported", kind: "NO_UNSUPPORTED_CLAIM" },
  ];
  if (taskClass === "LEAD_LIST") predicates.push(
    { id: "exact_lead_count", kind: "COUNT_EQUALS", ...{ value: count } },
    { id: "unique_people_and_companies", kind: "NO_DUPLICATES" },
    { id: "founder_identity_supported", kind: "FIELD_NONEMPTY", ...{ field: "identityQuote" } },
    { id: "icp_fit_supported", kind: "FIELD_NONEMPTY", ...{ field: "fitQuote" } },
  );
  if (outreach) predicates.push({ id: "personalized_draft_for_each", kind: "FIELD_NONEMPTY", ...{ field: "draft" } });
  return { version: `${taskClass.toLowerCase()}/1.0.0`, taskClass, inputs, predicates };
}
export function estimateContract(contract: CompletionContract) {
  const maximum = Math.min(1500, 18 + contract.inputs.count * (contract.inputs.outreach ? 5 : 3));
  return { min: Math.ceil(maximum * 0.65), max: maximum };
}
