import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readWiki } from "@/lib/wiki";
import { memberFor } from "@/lib/army";
import { WikiList } from "@/components/dashboard/wiki-list";

export const dynamic = "force-dynamic";

/**
 * The team wiki — what your agents have learned, and your right to correct it.
 *
 * Shared memory only works if the founder can see and fix it. An agent that
 * records something wrong (a competitor's price misread, a customer described
 * badly) would otherwise poison every future run quietly, and the founder would
 * experience that as "the agents got worse" with no way to find out why. So the
 * cookbook is a page, not a hidden table: every entry is visible, editable and
 * deletable, and anything pinned is guaranteed into the next run's prompt.
 */
export default async function WikiPage() {
  const session = await requireUser("/dashboard/wiki");
  const admin = createAdminClient();
  const entries = await readWiki(admin, session.userId, 200);

  const withSource = entries.map((e) => ({
    ...e,
    sourceName: e.source_template
      ? (memberFor(e.source_template)?.name ?? e.source_template)
      : null,
  }));

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-fg-strong">Team memory</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          What your agents have learned about your business. Every agent reads
          this before it works, so the team builds on it instead of starting
          over each morning. Correct anything that is wrong — they will believe
          whatever is written here.
        </p>
      </header>

      <WikiList initial={withSource} />
    </div>
  );
}
