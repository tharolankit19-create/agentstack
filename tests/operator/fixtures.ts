import { Operator } from "../../apps/web/src/lib/operator/engine.ts";
import { fingerprint } from "../../apps/web/src/lib/operator/policy.ts";
import { SqlStore } from "./sql-store.ts";
import type { Providers } from "../../apps/web/src/lib/operator/providers.ts";
import type { Task } from "../../apps/web/src/lib/operator/contracts.ts";
export const leadPlan = {
  title: "Find qualified founders",
  steps: [
    {
      key: "research",
      title: "Research recent launches",
      objective: "Read recent launch sources",
      operation: "research",
      depends_on: [],
      inputs: {},
    },
    {
      key: "qualify",
      title: "Verify and qualify",
      objective: "Score source-backed founders",
      operation: "qualify",
      depends_on: ["research"],
      inputs: {},
    },
    {
      key: "draft",
      title: "Prepare outreach",
      objective: "Personalize outreach for qualified founders",
      operation: "draft",
      depends_on: ["qualify"],
      inputs: {},
    },
  ],
};
export function fixtureProviders(): Providers {
  const day = new Date().toISOString().slice(0, 10);
  const leads = Array.from({ length: 20 }, (_, i) => ({
    name: "Founder " + i,
    product: "Product " + i,
    product_url: `https://product${i}.example`,
    founder_url: `https://launch.example/founder-${i}`,
    source_url: "https://launch.example/recent",
    launched_at: day,
    quote: `Founder ${i} launched Product ${i} on ${day}`,
    score: i < 11 ? 80 : 20,
    reason: "Matches fixture ICP",
    email: `founder${i}@product${i}.example`,
  }));
  const text = leads
    .map(
      (l) =>
        l.quote + " " + l.email + " " + l.product_url + " " + l.founder_url,
    )
    .join("\n");
  const evidence = {
    url: "https://launch.example/recent",
    text,
    retrieved_at: new Date().toISOString(),
  };
  return {
    async model(role, _instruction, context: any) {
      if (role === "planner") return JSON.stringify(leadPlan);
      if (role === "classify") return JSON.stringify({ leads });
      return JSON.stringify({
        drafts: context.leads.map((l, i) => ({
          index: i,
          subject: "Launch feedback for " + l.product,
          text:
            "Hi " +
            l.name +
            ", I saw your launch of " +
            l.product +
            ". Here is a relevant distribution idea.",
        })),
      });
    },
    async search() {
      return [evidence];
    },
    async read() {
      return evidence;
    },
    async capture(url) {
      return {
        url,
        text,
        png: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jlpUAAAAASUVORK5CYII=",
      };
    },
  };
}
export function fixtureOperator(
  store: SqlStore,
  providers = fixtureProviders(),
) {
  return new Operator(
    store,
    async () => providers,
    async (t: Task, email: unknown) => {
      await store.pg.query(
        "insert into agentstack.kryx_approvals(user_id,goal_id,task_id,action,risk,payload,fingerprint) values($1,$2,$3,'email.send','EXTERNAL_COMMUNICATION',$4,$5) on conflict(task_id,fingerprint) do nothing",
        [
          t.user_id,
          t.goal_id,
          t.id,
          JSON.stringify(email),
          fingerprint("email.send", email),
        ],
      );
      return email;
    },
  );
}
