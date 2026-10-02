"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanEditor } from "./plan-editor";
import type { Goal, Task, Plan } from "@/lib/operator/contracts";

type Row = {
  id: string;
  action?: string;
  decision?: string;
  name?: string;
  title?: string;
  type?: string;
  created_at: string;
  status?: string;
  content?: string;
  sources?: { url: string }[];
  payload?: { from: string; to: string; subject: string; text: string };
  data?: Record<string, unknown>;
  enabled?: boolean;
  next_run?: string;
  value?: unknown;
  key?: string;
  description?: string;
  screenshot?: string;
  error?: string;
};
async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
function usePoll<T>(url: string, initial: T) {
  const [data, setData] = useState<T>(initial),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api(url));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load");
    }
  }, [url]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh]);
  return { data, error, refresh };
}
const Label = ({ status }: { status: string }) => (
  <span className={"op-status op-" + status.toLowerCase()}>
    {status.replaceAll("_", " ").toLowerCase()}
  </span>
);
export function OperatorHome({
  tasksOnly = false,
  publicView = false,
}: {
  tasksOnly?: boolean;
  publicView?: boolean;
}) {
  const router = useRouter(),
    { data, error, refresh } = usePoll<{ goals: Goal[] }>("/api/kryx/goals", {
      goals: [],
    });
  const [objective, setObjective] = useState(""),
    [website, setWebsite] = useState(""),
    [company, setCompany] = useState(""),
    [audience, setAudience] = useState(""),
    [sender, setSender] = useState(""),
    [budget, setBudget] = useState(100),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState("");
  async function start() {
    setBusy(true);
    setProblem("");
    try {
      const context = {
        ...(website ? { website } : {}),
        ...(company ? { company } : {}),
        ...(audience ? { audience } : {}),
        ...(sender ? { sender_email: sender } : {}),
      };
      const r = await api("/api/kryx/goals", "POST", {
        objective,
        context,
        budget,
        idempotency_key: crypto.randomUUID(),
      });
      router.push("/dashboard/tasks/" + r.id);
      await refresh();
    } catch (e) {
      if (publicView && e instanceof Error && e.message === "Sign in first.")
        router.push("/login?mode=signup");
      else setProblem(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="op">
      <div className="op-heading">
        <span>Kryx / {tasksOnly ? "Tasks" : "Home"}</span>
        <Link href="/dashboard/activity">Activity ↗</Link>
      </div>
      <h1>
        {tasksOnly ? "Your goals. Kryx’s work." : "What should Kryx get done?"}
      </h1>
      {!tasksOnly && (
        <>
          <p className="op-sub">
            Give Kryx an outcome. Review the plan, then leave it to work.
          </p>
          <div className="op-composer">
            <textarea
              aria-label="Marketing goal"
              placeholder="Find 20 recently launched SaaS founders and prepare personalized outreach…"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
            <div className="op-composer-footer">
              <div>
                <Link href="/dashboard/connectors">Apps</Link>
                <Link href="/dashboard/routines">Schedule</Link>
                <Link href="/dashboard/computer">Computer</Link>
              </div>
              <button
                disabled={busy || objective.trim().length < 8}
                onClick={start}
              >
                {busy ? "Creating goal…" : "Start work →"}
              </button>
            </div>
          </div>
          <details className="op-context">
            <summary>Business context & maximum spend</summary>
            <div className="op-fields">
              <label>
                Company
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
              <label>
                Website
                <input
                  type="url"
                  value={website}
                  placeholder="https://your-product.com"
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
              <label>
                Who needs your product?
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </label>
              <label>
                Verified email sender
                <input
                  type="email"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                />
              </label>
              <label>
                Maximum credits for this goal
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={budget}
                  onChange={(e) => setBudget(+e.target.value)}
                />
              </label>
            </div>
            <p>
              Usage appears on the task. External sending requires approval by
              default.
            </p>
          </details>
          <div className="op-examples">
            {[
              "Find 10 people who may need my product.",
              "Audit my landing page and improve conversion.",
              "Turn this launch into a week of content.",
            ].map((s) => (
              <button key={s} onClick={() => setObjective(s)}>
                {s}
              </button>
            ))}
          </div>
        </>
      )}
      {(problem || (!publicView && error)) && (
        <p role="alert" className="op-error">
          {problem || error}
        </p>
      )}
      {["Working", "Waiting for you", "Completed"].map((group) => {
        const rows = data.goals.filter((g) =>
          group === "Completed"
            ? g.status === "COMPLETED"
            : group === "Waiting for you"
              ? ["READY", "WAITING_FOR_APPROVAL", "FAILED", "PAUSED"].includes(
                  g.status,
                )
              : ["PLANNING", "RUNNING", "WAITING"].includes(g.status),
        );
        return (
          <div className="op-section" key={group}>
            <h2>{group}</h2>
            {!rows.length ? (
              <p className="op-empty">
                {group === "Working"
                  ? "No active work. Give Kryx its next goal."
                  : "Nothing here yet."}
              </p>
            ) : (
              rows.map((g) => (
                <Link
                  className="op-task"
                  href={"/dashboard/tasks/" + g.id}
                  key={g.id}
                >
                  <div>
                    <h3>{g.plan?.title || g.objective}</h3>
                    <p>{g.objective}</p>
                  </div>
                  <Label status={g.status} />
                </Link>
              ))
            )}
          </div>
        );
      })}
      <div className="op-links">
        <Link href="/dashboard/routines">Set up a routine ↗</Link>
        <Link href="/dashboard/memory">Teach Kryx your business ↗</Link>
      </div>
    </section>
  );
}
type Detail = {
  goal: Goal | null;
  tasks: Task[];
  artifacts: Row[];
  approvals: Row[];
  task_events: Row[];
  computer_sessions: Row[];
  tool_runs: Row[];
};
export function TaskDetail({ id }: { id: string }) {
  const { data, error, refresh } = usePoll<Detail>("/api/kryx/goals/" + id, {
    goal: null,
    tasks: [],
    artifacts: [],
    approvals: [],
    task_events: [],
    computer_sessions: [],
    tool_runs: [],
  });
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("Activity"),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  const g = data.goal;
  async function action(name: string) {
    setBusy(true);
    try {
      await api("/api/kryx/goals/" + id, "PATCH", { action: name });
      await refresh();
    } catch (e) {
      setProblem(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
  async function approval(a: Row, decision: string) {
    try {
      await api("/api/kryx/approvals/" + a.id, "POST", { decision });
      await refresh();
    } catch (e) {
      setProblem(String(e instanceof Error ? e.message : e));
    }
  }
  if (!g)
    return (
      <section className="op">
        <Link href="/dashboard">← Home</Link>
        <p role={error ? "alert" : undefined}>{error || "Loading task…"}</p>
      </section>
    );
  const active = data.tasks.filter((t) => t.status !== "CANCELLED");
  const done = active.filter((t) => t.status === "COMPLETED").length,
    plan = g.plan as Plan | null;
  return (
    <section className="op">
      <Link href="/dashboard/tasks">← Tasks</Link>
      <div className="op-heading">
        <span>Goal</span>
        <Label status={g.status} />
      </div>
      <h1>{plan?.title || g.objective}</h1>
      <p className="op-sub">{g.objective}</p>
      <div className="op-toolbar">
        <span>
          {done}/{active.length} tasks · {g.spent}/{g.budget} credits · created{" "}
          {new Date(g.created_at).toLocaleString()}
        </span>
        <div>
          {g.status === "READY" && (
            <>
              <button disabled={busy} onClick={() => action("start")}>
                Start plan
              </button>
              <button
                className="op-secondary"
                onClick={() => {
                  setEditing(true);
                  setTab("Plan");
                }}
              >
                Edit plan
              </button>
            </>
          )}
          {["PAUSED", "FAILED"].includes(g.status) && (
            <button disabled={busy} onClick={() => action("resume")}>
              Resume
            </button>
          )}
          {["RUNNING", "PLANNING"].includes(g.status) && (
            <button disabled={busy} onClick={() => action("pause")}>
              Pause
            </button>
          )}
          {!["COMPLETED", "CANCELLED"].includes(g.status) && (
            <button disabled={busy} onClick={() => action("cancel")}>
              Cancel
            </button>
          )}
        </div>
      </div>
      {(error || problem) && (
        <p className="op-error" role="alert">
          {problem || error}
        </p>
      )}
      {data.approvals
        .filter((a) =>
          ["PENDING", "APPROVED", "EXECUTING", "UNKNOWN"].includes(
            a.status || "",
          ),
        )
        .map((a) => (
          <details
            className="op-approval"
            key={a.id}
            open={a.status === "PENDING"}
          >
            <summary>
              {a.status === "PENDING" ? "Waiting for you" : a.status}: Send
              email to {a.payload?.to}
            </summary>
            <p>From: {a.payload?.from}</p>
            <h3>{a.payload?.subject}</h3>
            <pre>{a.payload?.text}</pre>
            {a.error && <p role="alert">{a.error}</p>}
            {a.status === "PENDING" && (
              <div>
                <button onClick={() => approval(a, "APPROVED")}>
                  Approve this exact email
                </button>
                <button
                  className="op-secondary"
                  onClick={() => approval(a, "DENIED")}
                >
                  Decline
                </button>
              </div>
            )}
          </details>
        ))}
      <nav className="op-tabs">
        {["Activity", "Plan", "Artifacts", "Computer", "Memory"].map((t) => (
          <button aria-selected={tab === t} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "Activity" && (
        <div className="op-timeline">
          {!data.task_events.length ? (
            <p>Waiting for the background worker.</p>
          ) : (
            [...data.task_events]
              .sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )
              .map((e) => (
                <article key={e.id}>
                  <time>{new Date(e.created_at).toLocaleTimeString()}</time>
                  <div>
                    <strong>{e.type?.replaceAll(".", " / ")}</strong>
                    <p>
                      {String(
                        e.data?.summary ||
                          e.data?.title ||
                          e.data?.error ||
                          e.data?.action ||
                          "",
                      )}
                    </p>
                    {e.type === "worker.handoff" && (
                      <details>
                        <summary>Worker handoff</summary>
                        <pre>{JSON.stringify(e.data, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </article>
              ))
          )}
        </div>
      )}
      {tab === "Plan" && (
        <div>
          {editing && plan && (
            <PlanEditor
              plan={plan}
              onSave={async (p) => {
                try {
                  await api("/api/kryx/goals/" + id, "PATCH", {
                    action: "edit",
                    plan: p,
                  });
                  setEditing(false);
                  await refresh();
                } catch (e) {
                  setProblem(e instanceof Error ? e.message : "Could not save");
                }
              }}
            />
          )}
          {!plan ? (
            <p>Kryx is creating a plan. Execution starts after your review.</p>
          ) : (
            data.tasks
              .filter(
                (t) =>
                  t.operation !== "plan" &&
                  (t.status !== "CANCELLED" || g.status === "CANCELLED"),
              )
              .sort(
                (a, b) =>
                  plan.steps.findIndex(
                    (s) => s.key === (a.inputs._plan_key || a.key),
                  ) -
                  plan.steps.findIndex(
                    (s) => s.key === (b.inputs._plan_key || b.key),
                  ),
              )
              .map((t) => (
                <article className="op-task" key={t.id}>
                  <div>
                    <h3>{t.title}</h3>
                    <p>{t.objective}</p>
                    {!!t.output?.summary && <p>{String(t.output.summary)}</p>}
                  </div>
                  <Label status={t.status} />
                </article>
              ))
          )}
        </div>
      )}
      {tab === "Artifacts" && <ArtifactList rows={data.artifacts} />}
      {tab === "Computer" && (
        <div>
          {data.computer_sessions.length ? (
            data.computer_sessions.map((s) => (
              <article key={s.id}>
                <Label status={s.status || "ACTIVE"} />
                <p>
                  Workspace computer · browser profile persists between tasks.
                </p>
                {s.screenshot && (
                  <img
                    className="op-screenshot"
                    alt="Captured page in Kryx computer"
                    src={"data:image/png;base64," + s.screenshot}
                  />
                )}
              </article>
            ))
          ) : (
            <p className="op-empty">
              No computer evidence yet. Browser work requires a configured cloud
              runtime.
            </p>
          )}
        </div>
      )}
      {tab === "Memory" && <ResourceView kind="memories" embedded />}
      {g.status === "COMPLETED" && (
        <button
          className="op-secondary"
          onClick={async () => {
            try {
              await api("/api/kryx/resources?kind=skills", "POST", {
                goal_id: id,
                name: plan?.title || "Marketing workflow",
              });
              setProblem("Saved as a tested Skill.");
            } catch (e) {
              setProblem(String(e instanceof Error ? e.message : e));
            }
          }}
        >
          Save this workflow as a Skill
        </button>
      )}
    </section>
  );
}
function ArtifactList({ rows }: { rows: Row[] }) {
  return (
    <div>
      {!rows.length ? (
        <p className="op-empty">Finished artifacts will appear here.</p>
      ) : (
        rows.map((a) => (
          <details className="op-artifact" key={a.id}>
            <summary>
              {a.name} <span>{a.type}</span>
            </summary>
            <a href={"/api/kryx/artifacts/" + a.id}>Download ↗</a>
            {a.type === "screenshot" ? (
              <img
                alt={a.name}
                className="op-screenshot"
                src={"data:image/png;base64," + a.content}
              />
            ) : (
              <pre>{a.content}</pre>
            )}
            <p>Sources</p>
            {a.sources?.map((s, i) => (
              <a href={s.url} key={i} target="_blank" rel="noopener noreferrer">
                {s.url}
              </a>
            ))}
          </details>
        ))
      )}
    </div>
  );
}
export function ResourceView({
  kind,
  embedded = false,
}: {
  kind: string;
  embedded?: boolean;
}) {
  const router = useRouter(),
    { data, error, refresh } = usePoll<{ rows: Row[] }>(
      "/api/kryx/resources?kind=" + kind,
      { rows: [] },
    );
  const [problem, setProblem] = useState("");
  async function submit(form: FormData) {
    try {
      let body: unknown;
      if (kind === "memories")
        body = {
          type: form.get("type"),
          key: form.get("key"),
          value: form.get("value"),
        };
      else if (kind === "approval_rules")
        body = { action: form.get("action"), decision: form.get("decision") };
      else
        body = {
          name: form.get("name"),
          objective: form.get("objective"),
          context: {
            ...(form.get("competitors")
              ? {
                  competitors: String(form.get("competitors"))
                    .split(",")
                    .map((s) => s.trim()),
                }
              : {}),
          },
          schedule: {
            hour: Number(form.get("hour")),
            minute: 0,
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            timezone: form.get("timezone"),
          },
        };
      await api("/api/kryx/resources?kind=" + kind, "POST", body);
      await refresh();
      setProblem("Saved.");
    } catch (e) {
      setProblem(String(e instanceof Error ? e.message : e));
    }
  }
  const title =
    {
      memories: "Memory",
      routines: "Routines",
      skills: "Skills",
      artifacts: "Artifacts",
      task_events: "Activity",
      computer_sessions: "Computer",
      approval_rules: "Approval rules",
    }[kind] || kind;
  return (
    <section className="op">
      {!embedded && (
        <>
          <div className="op-heading">Kryx / {title}</div>
          <h1>{title}</h1>
          <p className="op-sub">
            {kind === "memories"
              ? "Business context and verified lessons. Consequential facts are checked live."
              : kind === "skills"
                ? "Workflows saved from completed work. Run a skill without managing workers."
                : kind === "routines"
                  ? "Scheduled work continues after you close the tab. External actions still follow your approval rules."
                  : "Evidence from real execution."}
          </p>
        </>
      )}
      {kind === "approval_rules" && (
        <form action={submit} className="op-fields">
          <label>
            Action
            <select name="action">
              {[
                ["web.read", "Read pages"],
                ["artifact.create", "Create drafts"],
                ["email.send", "Send external email"],
                ["social.publish", "Publish social posts"],
                ["production.deploy", "Change production"],
                ["purchase", "Purchases"],
                ["delete", "Delete data"],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rule
            <select name="decision">
              <option value="ASK">Always ask</option>
              <option value="ALLOW">Always allow</option>
              <option value="DENY">Never allow</option>
            </select>
          </label>
          <button>Save rule</button>
        </form>
      )}
      {["memories", "routines"].includes(kind) && (
        <details className="op-context">
          <summary>
            {kind === "memories" ? "Add business knowledge" : "Create routine"}
          </summary>
          <form action={submit} className="op-fields">
            {kind === "memories" ? (
              <>
                <label>
                  Type
                  <select name="type">
                    {[
                      "BUSINESS",
                      "AUDIENCE",
                      "STYLE",
                      "PROFILE",
                      "PROJECT",
                      "PROCEDURAL",
                      "FACT",
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Key
                  <input name="key" required placeholder="brand_voice" />
                </label>
                <label>
                  Knowledge
                  <textarea name="value" required />
                </label>
              </>
            ) : (
              <>
                <label>
                  Name
                  <input name="name" required />
                </label>
                <label>
                  Outcome
                  <textarea name="objective" required minLength={8} />
                </label>
                <label>
                  Hour (0–23)
                  <input
                    name="hour"
                    type="number"
                    min="0"
                    max="23"
                    defaultValue={9}
                    required
                  />
                </label>
                <label>
                  Timezone
                  <input
                    name="timezone"
                    defaultValue={
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                    required
                  />
                </label>
                <label>
                  Competitor URLs (comma separated)
                  <input
                    name="competitors"
                    placeholder="https://competitor.com/pricing"
                  />
                </label>
              </>
            )}
            <button>Save</button>
          </form>
        </details>
      )}
      {(error || problem) && <p role="alert">{problem || error}</p>}
      {kind === "artifacts" ? (
        <ArtifactList rows={data.rows} />
      ) : (
        <div className="op-section">
          {!data.rows.length ? (
            <p className="op-empty">No {title.toLowerCase()} yet.</p>
          ) : (
            data.rows.map((r) => (
              <article className="op-task" key={r.id}>
                <div>
                  <h3>{r.name || r.key || r.type || r.title || r.action}</h3>
                  <p>
                    {kind === "approval_rules"
                      ? r.decision
                      : kind === "memories"
                        ? typeof r.value === "string"
                          ? r.value
                          : JSON.stringify(r.value)
                        : r.description ||
                          (r.next_run &&
                            "Next run: " +
                              new Date(r.next_run).toLocaleString())}
                  </p>
                  {kind === "task_events" && (
                    <pre>{JSON.stringify(r.data, null, 2)}</pre>
                  )}
                  {kind === "computer_sessions" && r.screenshot && (
                    <img
                      alt="Computer evidence"
                      className="op-screenshot"
                      src={"data:image/png;base64," + r.screenshot}
                    />
                  )}
                </div>
                {kind === "routines" && (
                  <button
                    className="op-secondary"
                    onClick={async () => {
                      await api("/api/kryx/resources?kind=routines", "PATCH", {
                        id: r.id,
                        enabled: !r.enabled,
                      });
                      await refresh();
                    }}
                  >
                    {r.enabled ? "Pause" : "Enable"}
                  </button>
                )}
                {kind === "skills" && (
                  <button
                    onClick={async () => {
                      try {
                        const g = await api(
                          "/api/kryx/skills/" + r.id,
                          "POST",
                          {
                            context: {},
                            budget: 100,
                            idempotency_key: crypto.randomUUID(),
                          },
                        );
                        router.push("/dashboard/tasks/" + g.id);
                      } catch (e) {
                        setProblem(String(e instanceof Error ? e.message : e));
                      }
                    }}
                  >
                    Run skill
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
