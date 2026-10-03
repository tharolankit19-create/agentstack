import type { createAdminClient } from "@/lib/supabase/admin";
import type { Artifact, Goal, Task } from "./contracts";
import { redact } from "./policy";
export class Store {
  constructor(public db: ReturnType<typeof createAdminClient>) {}
  async rpc<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const r = await this.db.rpc(name, args);
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  }
  async rows<T = Record<string, unknown>>(
    table: string,
    user: string,
    goal?: string,
  ): Promise<T[]> {
    let q = this.db
      .from("kryx_" + table)
      .select("*")
      .eq("user_id", user);
    if (goal) q = q.eq("goal_id", goal);
    const r = await q.limit(500);
    if (r.error) throw new Error(r.error.message);
    return r.data as T[];
  }
  async goal(task: Task): Promise<Goal> {
    const r = await this.db
      .from("kryx_goals")
      .select("*")
      .eq("id", task.goal_id)
      .eq("user_id", task.user_id)
      .single();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  async dependencies(t: Task) {
    const r = await this.db
      .from("kryx_task_dependencies")
      .select("depends_on")
      .eq("task_id", t.id)
      .eq("user_id", t.user_id);
    if (r.error) throw new Error(r.error.message);
    const ids = r.data.map((r) => r.depends_on);
    if (!ids.length) return [];
    const d = await this.db
      .from("kryx_tasks")
      .select("id,title,operation,output")
      .in("id", ids)
      .eq("user_id", t.user_id)
      .eq("status", "COMPLETED");
    if (d.error) throw new Error(d.error.message);
    return d.data;
  }
  async event(t: Task, type: string, data: unknown) {
    const r = await this.db.from("kryx_task_events").insert({
      user_id: t.user_id,
      goal_id: t.goal_id,
      task_id: t.id,
      type,
      data: redact(data),
    });
    if (r.error) throw new Error(r.error.message);
  }
  async finish(t: Task, output: unknown, artifacts: Artifact[]) {
    await this.rpc("kryx_finish", {
      p_task: t.id,
      p_token: t.lease_token,
      p_output: redact(output),
      p_artifacts: redact(artifacts),
    });
  }
  async update(
    table: string,
    user: string,
    id: string,
    values: Record<string, unknown>,
  ) {
    const r = await this.db
      .from("kryx_" + table)
      .update(values)
      .eq("id", id)
      .eq("user_id", user);
    if (r.error) throw new Error(r.error.message);
  }
}
