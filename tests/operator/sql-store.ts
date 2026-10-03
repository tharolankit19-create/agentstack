import { Store } from "../../apps/web/src/lib/operator/store.ts";
import type { Task, Goal } from "../../apps/web/src/lib/operator/contracts.ts";
import { redact } from "../../apps/web/src/lib/operator/policy.ts";
export class SqlStore extends Store {
  constructor(public pg: any) {
    super({} as any);
  }
  async rpc<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const pairs = Object.entries(args);
    const result = await this.pg.query(
      `select agentstack.${name}(${pairs.map(([k], i) => k + "=> $" + (i + 1)).join(",")}) result`,
      pairs.map(([, v]) =>
        v && typeof v === "object" ? JSON.stringify(v) : v,
      ),
    );
    return result.rows[0]?.result as T;
  }
  async rows<T = Record<string, unknown>>(
    table: string,
    user: string,
    goal?: string,
  ): Promise<T[]> {
    const q = await this.pg.query(
      `select * from agentstack.kryx_${table} where user_id=$1 ${goal ? "and goal_id=$2" : ""}`,
      [user, ...(goal ? [goal] : [])],
    );
    return q.rows;
  }
  async goal(t: Task): Promise<Goal> {
    return (
      await this.pg.query(
        "select * from agentstack.kryx_goals where id=$1 and user_id=$2",
        [t.goal_id, t.user_id],
      )
    ).rows[0];
  }
  async dependencies(t: Task) {
    return (
      await this.pg.query(
        "select dep.id,dep.title,dep.operation,dep.output from agentstack.kryx_task_dependencies d join agentstack.kryx_tasks dep on dep.id=d.depends_on where d.task_id=$1 and d.user_id=$2 and dep.status='COMPLETED'",
        [t.id, t.user_id],
      )
    ).rows;
  }
  async event(t: Task, type: string, data: unknown) {
    await this.pg.query(
      "insert into agentstack.kryx_task_events(user_id,goal_id,task_id,type,data) values($1,$2,$3,$4,$5)",
      [t.user_id, t.goal_id, t.id, type, JSON.stringify(redact(data))],
    );
  }
}
