/**
 * What kind of tool is this?
 *
 * The directory is 800+ rows long, which is past the size where anyone reads
 * it top to bottom. Verdict already splits it three ways; this splits it the
 * other way, by the part of the business the tool sits in — because "show me
 * every marketing tool I could drop" is the question people actually arrive
 * with, and it is not answerable by searching a product name they have not
 * thought of yet.
 *
 * Thirteen buckets, not sixty. A filter with sixty options is a second search
 * problem.
 */

export type CategoryId =
  | "marketing"
  | "content"
  | "sales"
  | "support"
  | "data"
  | "product"
  | "people"
  | "design"
  | "infrastructure"
  | "productivity"
  | "realtime"
  | "legal"
  | "personal";

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "marketing", label: "Marketing & SEO" },
  { id: "content", label: "Content & Social" },
  { id: "sales", label: "Sales & CRM" },
  { id: "support", label: "Support" },
  { id: "data", label: "Analytics & Finance" },
  { id: "product", label: "Product & Docs" },
  { id: "people", label: "Hiring & People" },
  { id: "design", label: "Design & Creative" },
  { id: "infrastructure", label: "Infrastructure & Dev" },
  { id: "productivity", label: "Productivity & Ops" },
  { id: "realtime", label: "Calls & Recording" },
  { id: "legal", label: "Legal & Finance ops" },
  { id: "personal", label: "Personal" },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category.label]),
) as Record<CategoryId, string>;

/**
 * Which bucket an agent's work belongs to.
 *
 * Keyed by template id rather than by tool, because the agent is the thing
 * that defines the job — every tool a given agent replaces is doing the same
 * job by definition.
 */
export const CATEGORY_FOR_TEMPLATE: Record<string, CategoryId> = {
  "seo-agent": "marketing",
  "competitor-agent": "marketing",
  "ads-agent": "marketing",
  "landing-agent": "marketing",

  "content-agent": "content",
  "blog-agent": "content",
  "newsletter-agent": "content",
  "repurpose-agent": "content",
  "video-script-agent": "content",
  "community-agent": "content",

  "outreach-agent": "sales",
  "crm-agent": "sales",
  "lead-agent": "sales",
  "proposal-agent": "sales",
  "meeting-agent": "sales",

  "inbox-agent": "support",
  "review-agent": "support",
  "feedback-agent": "support",
  "onboarding-agent": "support",

  "docs-agent": "product",
  "changelog-agent": "product",

  "analytics-agent": "data",
  "finance-agent": "data",
  "research-agent": "data",

  "hiring-agent": "people",
};

/**
 * For tools we say no to, the bucket comes from *why* we said no.
 *
 * The generator groups every "keep paying" tool under one of six reasons, and
 * each reason lines up with a part of the business cleanly enough to file
 * under. It is coarser than the source data was, on purpose.
 */
export const CATEGORY_FOR_KEEP_REASON: Record<string, CategoryId> = {
  "system-of-record": "productivity",
  infrastructure: "infrastructure",
  canvas: "design",
  "expensive-to-be-wrong": "legal",
  realtime: "realtime",
  "not-work": "personal",
};
