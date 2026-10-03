import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
export const user = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
export async function database(path) {
  const db = new PGlite(path);
  await db.waitReady;
  const exists = await db.query(
    "select to_regclass('agentstack.kryx_goals') present",
  );
  if (exists.rows[0].present) return db;
  await db.exec(readFileSync("tests/operator/base.sql", "utf8"));
  const file = readdirSync("supabase/migrations").find((f) =>
    f.endsWith("_kryx_operator.sql"),
  );
  await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  for (const addition of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith("_kryx_tool_adapters.sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + addition, "utf8"));
  await db.query(
    "insert into agentstack.profiles(id,credit_balance) values($1,1000),($2,1000)",
    [user, other],
  );
  return db;
}
export async function call(db, name, args = []) {
  const q = await db.query(
    `select agentstack.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
    args.map((a) => (a && typeof a === "object" ? JSON.stringify(a) : a)),
  );
  return q.rows[0].result;
}
export async function create(
  db,
  objective = "Find recently launched founders",
  context = {},
) {
  return call(db, "kryx_create_goal", [
    user,
    objective,
    context,
    100,
    "goal-" + Math.random(),
  ]);
}
export const plan = {
  title: "Find founders",
  steps: [
    {
      key: "research",
      title: "Research founders",
      objective: "Verify recent launch evidence",
      operation: "research",
      depends_on: [],
      inputs: {},
    },
    {
      key: "qualify",
      title: "Qualify founders",
      objective: "Score and deduplicate",
      operation: "qualify",
      depends_on: ["research"],
      inputs: {},
    },
  ],
};
