import { test } from "node:test";
import assert from "node:assert/strict";
import { database, create, call, user } from "./database.mjs";
import { SqlStore } from "./sql-store.ts";
import { fixtureOperator, fixtureProviders } from "./fixtures.ts";
test("acceptance 1: plan, verify 20 -> 11, artifacts, personalized drafts, stop before send", async () => {
  const db = await database(),
    store = new SqlStore(db),
    op = fixtureOperator(store);
  const g = await create(db, "Find 20 founders and prepare outreach", {
    sender_email: "me@company.example",
  });
  await op.tick();
  assert.equal(
    (await db.query("select status from agentstack.kryx_goals")).rows[0].status,
    "READY",
  );
  await call(db, "kryx_control", [user, g, "start"]);
  for (let i = 0; i < 3; i++) await op.tick();
  const goal = (await db.query("select * from agentstack.kryx_goals")).rows[0];
  assert.equal(goal.status, "WAITING_FOR_APPROVAL");
  const artifacts = (await db.query("select * from agentstack.kryx_artifacts"))
    .rows;
  assert(
    artifacts
      .find((a) => a.name === "qualified-leads.csv")
      .content.includes("Founder 10"),
  );
  assert(
    !artifacts
      .find((a) => a.name === "qualified-leads.csv")
      .content.includes("Founder 19"),
  );
  const approvals = (await db.query("select * from agentstack.kryx_approvals"))
    .rows;
  assert.equal(approvals.length, 11);
  assert(approvals.every((a) => a.status === "PENDING"));
  await assert.rejects(
    call(db, "kryx_consume_approval", [
      user,
      approvals[0].id,
      approvals[0].fingerprint,
    ]),
  );
  await db.close();
});
test("acceptance 2: monitor stores checkpoint and stays quiet when nothing material changed", async () => {
  const db = await database(),
    store = new SqlStore(db),
    p = fixtureProviders();
  p.model = async () =>
    JSON.stringify({
      title: "Monitor",
      steps: [
        {
          key: "monitor",
          title: "Check competitors",
          objective: "Compare pricing",
          operation: "monitor",
          depends_on: [],
          inputs: { urls: ["https://launch.example/recent"] },
        },
      ],
    });
  const op = fixtureOperator(store, p);
  for (let i = 0; i < 2; i++) {
    const g = await create(db, "Monitor competitors", { routine_id: "test" });
    await op.tick();
    await op.tick();
    const row = (
      await db.query(
        "select output from agentstack.kryx_tasks where goal_id=$1 and operation='monitor'",
        [g],
      )
    ).rows[0];
    assert.equal(row.output.changes.length, 0);
  }
  const memories = (await db.query("select * from agentstack.kryx_memories"))
    .rows;
  assert.equal(memories.length, 1);
  assert.equal(memories[0].times_confirmed, 2);
  await db.close();
});
test("acceptance 3: page audit emits real provider evidence and two screenshot artifacts", async () => {
  const db = await database(),
    store = new SqlStore(db),
    p = fixtureProviders();
  p.model = async (role) =>
    role === "planner"
      ? JSON.stringify({
          title: "Audit",
          steps: [
            {
              key: "audit",
              title: "Audit conversion",
              objective: "Inspect the page",
              operation: "audit",
              depends_on: [],
              inputs: { url: "https://landing.example" },
            },
          ],
        })
      : "# Conversion audit\nCTA recommendation based on the supplied page text.";
  const op = fixtureOperator(store, p);
  const g = await create(db, "Audit my landing page");
  await op.tick();
  await call(db, "kryx_control", [user, g, "start"]);
  await op.tick();
  assert.equal(
    (await db.query("select count(*) count from agentstack.kryx_artifacts"))
      .rows[0].count,
    3,
  );
  assert.equal(
    (await db.query("select status from agentstack.kryx_goals")).rows[0].status,
    "COMPLETED",
  );
  await db.close();
});
test("acceptance 5: provider failure records error, retries, then pauses visibly without fake success", async () => {
  const db = await database(),
    store = new SqlStore(db),
    p = fixtureProviders();
  p.search = async () => {
    throw new Error("Search provider unavailable");
  };
  const op = fixtureOperator(store, p);
  const g = await create(db);
  await op.tick();
  await call(db, "kryx_control", [user, g, "start"]);
  for (let i = 0; i < 3; i++) {
    await op.tick();
    await db.exec(
      "update agentstack.kryx_tasks set available_at=now() where operation='research'",
    );
  }
  assert.equal(
    (await db.query("select status from agentstack.kryx_goals")).rows[0].status,
    "FAILED",
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_artifacts")).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from agentstack.kryx_task_events where type='task.failed'",
      )
    ).rows.length,
    3,
  );
  await db.close();
});
