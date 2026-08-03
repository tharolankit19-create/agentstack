import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { formatRelative } from "@/lib/utils";
import type { Generation } from "@/lib/supabase/types";

const KIND_LABEL: Record<string, string> = {
  tweet: "Tweet",
  linkedin: "LinkedIn",
  review_reply: "Review reply",
  lead: "Lead",
  note: "Note",
};

export function GenerationList({ generations }: { generations: Generation[] }) {
  if (generations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
        Nothing yet. Deploy the agent and it will start filling this up on its
        schedule — or open the chat and ask it for something now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {generations.map((generation) => {
        const flagged = Boolean(
          generation.meta && (generation.meta as { flagged?: boolean }).flagged,
        );
        const published = Boolean(
          generation.meta && (generation.meta as { published?: boolean }).published,
        );

        return (
          <article
            key={generation.id}
            className="rounded-xl border border-line bg-surface-2 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="darkAccent">
                {KIND_LABEL[generation.kind] ?? generation.kind}
              </Badge>
              {published ? <Badge tone="darkSuccess">Published</Badge> : null}
              {flagged ? <Badge tone="darkWarning">Send this one yourself</Badge> : null}
              <span className="text-xs text-muted">
                {formatRelative(generation.created_at)}
              </span>
              <CopyButton value={generation.content} className="ml-auto" />
            </div>

            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg">
              {generation.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}
