import type { Replaceable } from "@/lib/replaceability";
import { ToolIcon } from "@/components/ui/tool-icon";

/**
 * The wall of things you are already paying for.
 *
 * Most landing pages put a logo row here to say "these companies use us". This
 * one says the opposite: these are the subscriptions on your card, and the row
 * exists so a visitor finds two or three they recognise before they have read
 * a single sentence. Recognition is what makes the rest of the page feel like
 * it is about them.
 *
 * Two identical tracks translated by exactly half the pair, so the loop has no
 * seam, and it pauses on hover so a name can actually be read.
 */
export function LogoStrip({ entries }: { entries: Replaceable[] }) {
  // The dataset's own prominence ranking, then price — the expensive, famous
  // ones are the ones worth showing.
  const featured = entries
    .filter((entry) => entry.domain && entry.monthlyUsd > 0)
    .sort(
      (a, b) => (b.priority ?? 3) - (a.priority ?? 3) || b.monthlyUsd - a.monthlyUsd,
    )
    .slice(0, 22);

  if (featured.length === 0) return null;

  return (
    <div className="marquee-host edge-fade overflow-hidden">
      <div className="marquee gap-3">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-3 pr-3" aria-hidden={copy === 1}>
            {featured.map((entry) => (
              <span
                key={entry.slug}
                className="flex shrink-0 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2"
              >
                <ToolIcon domain={entry.domain} name={entry.tool} className="size-5" />
                <span className="whitespace-nowrap text-sm font-medium text-muted">
                  {entry.tool}
                </span>
                <span className="cost whitespace-nowrap text-xs">
                  ${entry.monthlyUsd}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
