import { z } from "zod";
import { after } from "next/server";
import { advanceOperator } from "@/lib/operator/runner";
import { dispatchApprovals } from "@/lib/operator/gateway";
import { callableCronSecret } from "@/lib/cron-auth";
import { routeForAgent } from "@/lib/agent-model-routing";
import { loadConnectors, houseModelKey } from "@/lib/connectors";
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
import {
  adapterHash,
  adapterRequest,
  installAdapter,
} from "@/lib/operator/adapters";
import { publicUrl } from "@/lib/operator/network";
import { sealSecrets } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

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
    if (kind === "adapters") {
      if (req.method === "GET" && !id) {
        const rows = await store.rows("tool_adapters", user);
        const q = await store.db
          .from("kryx_adapter_credentials")
          .select("adapter_id")
          .eq("user_id", user);
        if (q.error) throw new Error("Could not load adapter connection state");
        const connected = new Set(q.data.map((r) => r.adapter_id));
        return Response.json({
          adapters: rows.map((r) => ({ ...r, connected: connected.has(r.id) })),
        });
      }
      if (req.method !== "POST" && req.method !== "PATCH")
        return Response.json(
          { error: "Unknown adapter operation" },
          { status: 404 },
        );
      const limit = rateLimit("adapter:" + user, 20, 600);
      if (!limit.allowed)
        return Response.json(
          { error: "Wait a moment before requesting more tool changes" },
          { status: 429 },
        );
      if (!id && req.method === "POST") {
        const b = z
          .object({
            documentation_url: z.url(),
            purpose: z.string().trim().min(8).max(1000),
            idempotency_key: z.uuid(),
          })
          .strict()
          .parse(await input());
        await publicUrl(b.documentation_url);
        const goal = await store.rpc("kryx_create_goal", {
          p_user: user,
          p_objective: b.purpose,
          p_context: { adapter_request: b.documentation_url },
          p_budget: 50,
          p_key: b.idempotency_key,
        });
        dispatch();
        return Response.json({ id: goal }, { status: 202 });
      }
      z.uuid().parse(id);
      const q = await store.db
        .from("kryx_tool_adapters")
        .select("*")
        .eq("user_id", user)
        .eq("id", id)
        .maybeSingle();
      if (q.error) throw new Error("Could not load adapter");
      if (!q.data)
        return Response.json({ error: "Adapter not found" }, { status: 404 });
      const row = q.data,
        operation = path[2];
      if (req.method === "PATCH") {
        z.object({ action: z.literal("disable") })
          .strict()
          .parse(await input());
        await store.rpc("kryx_disable_adapter", {
          p_user: user,
          p_adapter: id,
        });
        return Response.json({ ok: true });
      }
      if (operation === "install") {
        const b = z
          .object({
            approve_install: z.literal(true),
            manifest_hash: z.string().length(64),
          })
          .strict()
          .parse(await input());
        if (
          b.manifest_hash !== row.manifest_hash ||
          b.manifest_hash !== adapterHash(row.manifest)
        )
          throw new Error("Adapter definition changed");
        if (row.state !== "INSTALLED") installAdapter(row.manifest, true);
        await store.rpc("kryx_install_adapter", {
          p_user: user,
          p_adapter: id,
          p_hash: b.manifest_hash,
          p_approved: true,
        });
        return Response.json({ ok: true });
      }
      if (operation === "credential") {
        const b = z
          .object({ key: z.string().trim().min(6).max(2000).nullable() })
          .strict()
          .parse(await input());
        if (row.state !== "INSTALLED")
          throw new Error(
            "Install a tested adapter before connecting production credentials",
          );
        if (b.key && /[\r\n]/.test(b.key))
          throw new Error("Invalid credential");
        await store.rpc("kryx_adapter_credential", {
          p_user: user,
          p_adapter: id,
          p_ciphertext: b.key ? sealSecrets({ api_key: b.key }) : null,
        });
        return Response.json({ ok: true });
      }
      if (operation === "test") {
        const b = z
          .object({
            examples: z
              .record(
                z.string(),
                z.record(
                  z.string(),
                  z.union([
                    z.string().max(2000),
                    z.number().finite(),
                    z.boolean(),
                  ]),
                ),
              )
              .default({}),
            idempotency_key: z.uuid(),
          })
          .strict()
          .parse(await input());
        if (!["DRAFT", "TESTED"].includes(row.state))
          throw new Error("Only draft or tested adapters can be tested");
        const goal = await store.rpc("kryx_create_goal", {
          p_user: user,
          p_objective:
            "Test " + row.manifest.name + " without production credentials",
          p_context: { adapter_test: { adapter_id: id, examples: b.examples } },
          p_budget: 0,
          p_key: b.idempotency_key,
        });
        dispatch();
        return Response.json({ id: goal }, { status: 202 });
      }
      if (operation === "run") {
        const b = z
          .object({
            action: z.string(),
            parameters: z
              .record(
                z.string(),
                z.union([
                  z.string().max(2000),
                  z.number().finite(),
                  z.boolean(),
                ]),
              )
              .default({}),
            idempotency_key: z.uuid(),
          })
          .strict()
          .parse(await input());
        if (row.state !== "INSTALLED")
          throw new Error("Install the tested adapter first");
        adapterRequest(row.manifest, b.action, b.parameters);
        const goal = await store.rpc("kryx_create_goal", {
          p_user: user,
          p_objective: "Read " + row.manifest.name + " / " + b.action,
          p_context: {
            adapter_run: {
              adapter_id: id,
              action: b.action,
              parameters: b.parameters,
            },
          },
          p_budget: 0,
          p_key: b.idempotency_key,
        });
        dispatch();
        return Response.json({ id: goal }, { status: 202 });
      }
      return Response.json(
        { error: "Unknown adapter operation" },
        { status: 404 },
      );
    }
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
      after(async () => {
        try {
          if (b.decision === "APPROVED") await dispatchApprovals(store);
          await store.rpc("kryx_reconcile");
        } catch {
          console.error(
            "Kryx approval dispatch interrupted; durable approval retained.",
          );
        }
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
            action: z.string().refine((a) => Object.hasOwn(actions, a)),
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
      const keys = await loadConnectors(store.db, user);
      const modelKey = keys.model || (await houseModelKey(store.db));
      return Response.json({
        database: !q.error,
        scheduler_configured: !!(await callableCronSecret()),
        model_configured: routeForAgent("head-agent", modelKey).length > 0,
        computer_configured: !!(
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
