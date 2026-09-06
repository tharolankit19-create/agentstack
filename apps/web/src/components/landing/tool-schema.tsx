import type { FreeAlternative } from "@/lib/free-alternatives";
import { VERDICT_COPY, type Replaceable } from "@/lib/replaceability";

/**
 * Structured data for a tool page.
 *
 * Two schemas, both earning their place:
 *
 *   - **FAQPage**, built from the questions the page genuinely answers. This
 *     is the one that can win an expanded result in search, and the rule for
 *     keeping it is strict: every question here must be visibly answered in
 *     the page body with the same substance. Marking up an answer the reader
 *     cannot find is what gets structured data ignored, or the site
 *     penalised.
 *   - **BreadcrumbList**, so the result shows Home › Directory › Tool rather
 *     than a raw URL.
 *
 * Emitted as JSON in a script tag. The content is our own prose from the
 * directory, so there is nothing user-supplied to escape — but it still goes
 * through JSON.stringify rather than string concatenation, and the one
 * sequence that can break out of a script element is neutralised below.
 */
export function ToolSchema({
  entry,
  alternatives,
  agentName,
  siteUrl,
}: {
  entry: Replaceable;
  alternatives: FreeAlternative[];
  agentName?: string;
  siteUrl: string;
}) {
  const url = `${siteUrl}/replace/${entry.slug}`;

  const questions: { q: string; a: string }[] = [
    {
      q: `Can an AI agent replace ${entry.tool}?`,
      a: `${VERDICT_COPY[entry.verdict].label}. ${entry.honestTake}`,
    },
  ];

  if (entry.doesNot.length > 0) {
    questions.push({
      q: `What can an agent not do that ${entry.tool} does?`,
      a: entry.doesNot.join(". ") + ".",
    });
  }

  if (agentName && entry.does.length > 0) {
    questions.push({
      q: `Which agent replaces ${entry.tool}?`,
      a: `The ${agentName}. It ${entry.does
        .map((line) => line.charAt(0).toLowerCase() + line.slice(1))
        .join(", ")}.`,
    });
  }

  if (alternatives.length > 0) {
    questions.push({
      q: `Is there a free alternative to ${entry.tool}?`,
      a: alternatives
        .map((alternative) => `${alternative.name} — ${alternative.note}`)
        .join(" "),
    });
  }

  if (entry.monthlyUsd > 0) {
    questions.push({
      q: `How much does ${entry.tool} cost?`,
      a: `About $${entry.monthlyUsd} a month at list price, which is $${
        entry.monthlyUsd * 12
      } a year. Marketing Agents Army starts at $49 a month, with a 3-day free trial.`,
    });
  }

  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: questions.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Marketing Agents Army", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "What can an agent replace?",
          item: `${siteUrl}/replace`,
        },
        { "@type": "ListItem", position: 3, name: entry.tool, item: url },
      ],
    },
  ];

  return (
    <script
      type="application/ld+json"
      // `</script>` inside a JSON string would end the element early. Escaping
      // the `<` is the standard fix and leaves the JSON valid.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
      }}
    />
  );
}
