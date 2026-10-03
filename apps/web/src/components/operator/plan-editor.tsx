"use client";
import { useState } from "react";
import type { Plan } from "@/lib/operator/contracts";
export function PlanEditor({
  plan,
  onSave,
}: {
  plan: Plan;
  onSave: (p: Plan) => Promise<void>;
}) {
  const [draft, setDraft] = useState(plan),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="op-section"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(draft);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Plan title
        <input
          className="block w-full border border-line rounded p-3 mt-2"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      {draft.steps.map((s, i) => (
        <div className="op-fields border-b border-line pb-4" key={s.key}>
          <label>
            Task title
            <input
              value={s.title}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((x, j) =>
                    i === j ? { ...x, title: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            Outcome
            <textarea
              value={s.objective}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((x, j) =>
                    i === j ? { ...x, objective: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <div>
            <p className="text-xs mb-2">Finish these tasks first</p>
            {draft.steps
              .filter((x) => x.key !== s.key)
              .map((dep) => (
                <label key={dep.key} className="!flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={s.depends_on.includes(dep.key)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((x, j) =>
                          i === j
                            ? {
                                ...x,
                                depends_on: e.target.checked
                                  ? [...x.depends_on, dep.key]
                                  : x.depends_on.filter((d) => d !== dep.key),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                  {dep.title}
                </label>
              ))}
          </div>
        </div>
      ))}
      <button disabled={busy}>{busy ? "Saving…" : "Save plan"}</button>
    </form>
  );
}
