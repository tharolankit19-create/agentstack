import { z } from "zod";
import { after } from "next/server";
import { advanceOperator } from "@/lib/operator/runner";
export const maxDuration = 300;
function dispatch() {
  after(async () => {
    try {
      await advanceOperator(3);
    } catch {
      /* The durable queue remains available to the heartbeat. */
    }
  });
}
import { requireApiUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Store } from "@/lib/operator/store";
import { nextRoutine, redact, actions } from "@/lib/operator/policy";
import { validatePlan } from "@/lib/operator/contracts";

const contextSchema = z
  .object({
    company: z.string().max(200).optional(),
    website: z.url().optional(),
    audience: z.string().max(3000).optional(),
    sender_email: z.email().optional(),
    competitors: z.array(z.url()).max(8).optional(),
  })
  .strict();
const goalSchema = z
  .object({
    objective: z.string().trim().min(8).max(4000),
    context: contextSchema.default({}),
    budget: z.number().int().min(0).max(100000).default(100),
    idempotency_key: z.uuid(),
  })
  .strict();
const kinds = [
  "routines",
  "skills",
  "memories",
  "artifacts",
  "task_events",
  "computer_sessions",
  "approval_rules",
  "tool_runs",
] as const;
type Ctx = { params: Promise<{ path: string[] }> };
async function handle(req: Request, ctx: Ctx) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;
  const user = auth.session.userId,
    store = new Store(createAdminClient()),
    path = (await ctx.params).path;
  try {
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && origin !== new URL(req.url).origin)
        return Response.json(
          { error: "Invalid request origin" },
          { status: 403 },
        );
    }
    const input = async () => {
      const s = await req.text();
      if (s.length > 50000) throw new Error("Request is too large");
      return JSON.parse(s);
    };
    const kind = path[0],
      id = path[1];
    if (kind === "goals" && !id && req.method === "GET") {
      const q = await store.db
        .from("kryx_goals")
        .select("*")
        .eq("user_id", user)
        .order("created_at", { ascending: false })
        .limit(100);
      if (q.error) throw new Error(q.error.message);
      return Response.json({ goals: q.data });
    }
    if (kind === "goals" && !id && req.method === "POST") {
      const b = goalSchema.parse(await input()),
        goal = await store.rpc("kryx_create_goal", {
          p_user: user,
          p_objective: b.objective,
          p_context: b.context,
          p_budget: b.budget,
          p_key: b.idempotency_key,
        });
      dispatch();
      return Response.json({ id: goal }, { status: 202 });
    }
    if (kind === "goals" && id) {
      z.uuid().parse(id);
      const g = await store.db
        .from("kryx_goals")
        .select("*")
        .eq("user_id", user)
        .eq("id", id)
        .maybeSingle();
      if (g.error) throw new Error(g.error.message);
      if (!g.data)
        return Response.json({ error: "Goal not found" }, { status: 404 });
      if (req.method === "GET") {
        const tables = [
          "tasks",
          "artifacts",
          "approvals",
          "task_events",
          "tool_runs",
          "computer_sessions",
        ];
        const data = await Promise.all(
          tables.map(async (k) => [
            k,
            (await store.rows(k, user, id)).map((row) => {
              const { lease_token, ...safe } = row;
              return safe;
            }),
          ]),
        );
        return Response.json({ goal: g.data, ...Object.fromEntries(data) });
      }
      if (req.method === "PATCH") {
        const raw = await input();
        if (raw.action === "edit") {
          const plan = validatePlan(raw.plan);
          await store.rpc("kryx_edit_plan", {
            p_user: user,
            p_goal: id,
            p_plan: plan,
          });
          return Response.json({ ok: true });
        }
        const b = z
          .object({ action: z.enum(["start", "resume", "pause", "cancel"]) })
          .strict()
          .parse(raw);
        await store.rpc("kryx_control", {
          p_user: user,
          p_goal: id,
          p_action: b.action,
        });
        if (b.action === "start" || b.action === "resume") dispatch();
        return Response.json({ ok: true });
      }
    }
    if (kind === "approvals" && id && req.method === "POST") {
      z.uuid().parse(id);
      const b = z
        .object({ decision: z.enum(["APPROVED", "DENIED"]) })
        .strict()
        .parse(await input());
      await store.rpc("kryx_decide_approval", {
        p_user: user,
        p_id: id,
        p_decision: b.decision,
      });
      return Response.json({ ok: true });
    }
    if (kind === "artifacts" && id && req.method === "GET") {
      z.uuid().parse(id);
      const q = await store.db
        .from("kryx_artifacts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user)
        .maybeSingle();
      if (q.error) throw new Error(q.error.message);
      if (!q.data)
        return Response.json({ error: "Artifact not found" }, { status: 404 });
      const a = q.data,
        name = String(a.name).replace(/[^\w.\-]/g, "_");
      return new Response(
        a.mime === "image/png"
          ? new Uint8Array(Buffer.from(a.content, "base64"))
          : a.content,
        {
          headers: {
            "content-type":
              a.mime === "image/png"
                ? "image/png"
                : "text/plain; charset=utf-8",
            "content-disposition": `attachment; filename="${name}"`,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
          },
        },
      );
    }
    if (kind === "resources") {
      const resource = new URL(req.url).searchParams.get("kind");
      if (!kinds.includes(resource as (typeof kinds)[number]))
        throw new Error("Unknown resource");
      if (req.method === "GET")
        return Response.json({ rows: await store.rows(resource!, user) });
      const b = await input();
      if (req.method === "POST" && resource === "memories") {
        const m = z
          .object({
            type: z.enum([
              "PROFILE",
              "BUSINESS",
              "AUDIENCE",
              "STYLE",
              "PROJECT",
              "PROCEDURAL",
              "EPISODIC",
              "COMPETITOR",
              "FACT",
            ]),
            key: z.string().min(1).max(120),
            value: z.string().min(1).max(6000),
          })
          .strict()
          .parse(b);
        await store.rpc("kryx_remember", {
          p_user: user,
          p_scope: "workspace",
          p_type: m.type,
          p_key: m.key,
          p_value: redact(m.value),
          p_source: { user_entered: true },
        });
        return Response.json({ ok: true });
      }
      if (req.method === "POST" && resource === "routines") {
        const routine = z
          .object({
            name: z.string().min(1).max(160),
            objective: z.string().min(8).max(4000),
            context: contextSchema.default({}),
            schedule: z.object({
              hour: z.number().int().min(0).max(23),
              minute: z.number().int().min(0).max(59),
              timezone: z.string().max(100),
              weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
            }),
          })
          .strict()
          .parse(b);
        const next = nextRoutine(routine.schedule, new Date());
        const q = await store.db
          .from("kryx_routines")
          .insert({
            ...routine,
            user_id: user,
            timezone: routine.schedule.timezone,
            next_run: next,
          })
          .select("id")
          .single();
        if (q.error) throw new Error(q.error.message);
        return Response.json(q.data, { status: 201 });
      }
      if (req.method === "POST" && resource === "skills") {
        const s = z
          .object({ goal_id: z.uuid(), name: z.string().min(1).max(120) })
          .strict()
          .parse(b);
        const q = await store.db
          .from("kryx_goals")
          .select("*")
          .eq("id", s.goal_id)
          .eq("user_id", user)
          .eq("status", "COMPLETED")
          .single();
        if (q.error || !q.data.plan)
          throw new Error("Only completed workflows can be saved");
        const plan = validatePlan(q.data.plan);
        const saved = await store.db
          .from("kryx_skills")
          .insert({
            user_id: user,
            name: s.name,
            description: q.data.objective,
            instructions: plan,
            state: "TESTED",
            success_count: 1,
            source: { goal_id: s.goal_id },
            required_tools: plan.steps.map((s) => s.operation),
            validation_steps: ["All tasks completed", "Artifacts stored"],
            approval_rules: { external: "ASK" },
          })
          .select("id")
          .single();
        if (saved.error) throw new Error(saved.error.message);
        return Response.json(saved.data, { status: 201 });
      }
      if (req.method === "POST" && resource === "approval_rules") {
        const r = z
          .object({
            action: z.string().refine((a) => !!actions[a]),
            decision: z.enum(["ALLOW", "ASK", "DENY"]),
          })
          .strict()
          .parse(b);
        const q = await store.db
          .from("kryx_approval_rules")
          .upsert({ ...r, user_id: user }, { onConflict: "user_id,action" });
        if (q.error) throw new Error(q.error.message);
        return Response.json({ ok: true });
      }
      if (req.method === "PATCH" && resource === "routines") {
        const r = z
          .object({ id: z.uuid(), enabled: z.boolean() })
          .strict()
          .parse(b);
        await store.update("routines", user, r.id, { enabled: r.enabled });
        return Response.json({ ok: true });
      }
      if (req.method === "POST" && resource === "skills" && id === "run") {
        throw new Error("Invalid route");
      }
    }
    if (kind === "skills" && id && req.method === "POST") {
      z.uuid().parse(id);
      const b = z
        .object({
          context: contextSchema.default({}),
          budget: z.number().int().min(0).max(100000).default(100),
          idempotency_key: z.uuid(),
        })
        .strict()
        .parse(await input());
      const q = await store.db
        .from("kryx_skills")
        .select("*")
        .eq("user_id", user)
        .eq("id", id)
        .in("state", ["TESTED", "ENABLED"])
        .single();
      if (q.error) throw new Error("Tested skill not found");
      const goal = await store.rpc("kryx_create_goal", {
        p_user: user,
        p_objective: q.data.description,
        p_context: { ...b.context, skill_id: id },
        p_budget: b.budget,
        p_key: b.idempotency_key,
      });
      dispatch();
      return Response.json({ id: goal }, { status: 202 });
    }
    if (kind === "diagnose" && req.method === "POST") {
      const q = await store.db
        .from("kryx_tasks")
        .select("status")
        .eq("user_id", user)
        .limit(500);
      return Response.json({
        database: !q.error,
        scheduler: !!process.env.CRON_SECRET,
        model: !!(process.env.CHAT_MODELS || process.env.KRYX_MODEL_PLANNER),
        computer: !!(
          process.env.KRYX_COMPUTER_API_URL && process.env.KRYX_COMPUTER_API_KEY
        ),
        queued: q.data?.filter((t) => ["WAITING", "READY"].includes(t.status))
          .length,
        failed: q.data?.filter((t) => t.status === "FAILED").length,
      });
    }
    return Response.json({ error: "Unknown operation" }, { status: 404 });
  } catch (e) {
    return Response.json(
      { error: redact(e instanceof Error ? e.message : "Operation failed") },
      { status: 400 },
    );
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle;
