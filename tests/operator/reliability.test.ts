import { test } from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "standardwebhooks";
import { database, create, call, user, other, plan } from "./database.mjs";
import { SqlStore } from "./sql-store.ts";
import { fixtureOperator, fixtureProviders } from "./fixtures.ts";
import { draftTeachingSkill } from "../../apps/web/src/lib/operator/teaching.ts";
import {
  installAdapter,
  adapterSecretAccess,
} from "../../apps/web/src/lib/operator/adapters.ts";
test("plan editing preserves cancelled history and the revision can complete", async () => {
  const db = await database();
  const g = await create(db),
    t = await call(db, "kryx_claim_task");
  await call(db, "kryx_save_plan", [t.id, t.lease_token, plan]);
  const revised = {
    title: "Revised",
    steps: [{ ...plan.steps[0], title: "New research" }],
  };
  await call(db, "kryx_edit_plan", [user, g, revised]);
  assert.equal(
    (
      await db.query(
        "select count(*) n from agentstack.kryx_tasks where status='CANCELLED'",
      )
    ).rows[0].n,
    2,
  );
  await call(db, "kryx_control", [user, g, "start"]);
  const next = await call(db, "kryx_claim_task");
  assert.equal(next.title, "New research");
  await call(db, "kryx_finish", [
    next.id,
    next.lease_token,
    { summary: "Done" },
    [],
  ]);
  assert.equal(
    (await db.query("select status from agentstack.kryx_goals")).rows[0].status,
    "COMPLETED",
  );
  await db.close();
});
test("material change and baseline commit together; exactly one notification is queued", async () => {
  const db = await database(),
    store = new SqlStore(db),
    p = fixtureProviders();
  let page = "Basic costs $9 monthly.";
  p.read = async (url) => ({
    url,
    text: page,
    retrieved_at: new Date().toISOString(),
  });
  p.model = async (role) =>
    role === "planner"
      ? JSON.stringify({
          title: "Monitor",
          steps: [
            {
              key: "monitor",
              title: "Monitor",
              objective: "Detect pricing changes",
              operation: "monitor",
              depends_on: [],
              inputs: { urls: ["https://pricing.example"] },
            },
          ],
        })
      : JSON.stringify({
          material: true,
          summary: "Pricing increased",
          quote: page,
        });
  const op = fixtureOperator(store, p);
  await create(db, "Watch pricing", { routine_id: "test" });
  await op.tick();
  await op.tick();
  assert.equal(
    (await db.query("select * from agentstack.kryx_notifications")).rows.length,
    0,
  );
  page = "Basic costs $19 monthly.";
  await create(db, "Watch pricing", { routine_id: "test" });
  await op.tick();
  await op.tick();
  assert.equal(
    (await db.query("select * from agentstack.kryx_notifications")).rows.length,
    1,
  );
  await create(db, "Watch pricing", { routine_id: "test" });
  await op.tick();
  await op.tick();
  assert.equal(
    (await db.query("select * from agentstack.kryx_notifications")).rows.length,
    1,
  );
  await db.close();
});
test("bounces suppress the approved recipient, reject cross-account events and dedupe delivery", async () => {
  const db = await database(),
    g = await create(db),
    t = await call(db, "kryx_claim_task");
  await db.query(
    "insert into agentstack.kryx_approvals(user_id,goal_id,task_id,action,risk,payload,fingerprint,status,provider_id) values($1,$2,$3,'email.send','EXTERNAL_COMMUNICATION',$4,'digest','EXECUTED','email-1')",
    [user, g, t.id, JSON.stringify({ to: "person@business.example" })],
  );
  assert.equal(
    await call(db, "kryx_email_event", [
      other,
      "evt",
      "email-1",
      "email.complained",
    ]),
    false,
  );
  assert.equal(
    await call(db, "kryx_email_event", [
      user,
      "evt",
      "email-1",
      "email.bounced",
    ]),
    true,
  );
  assert.equal(
    await call(db, "kryx_email_event", [
      user,
      "evt",
      "email-1",
      "email.bounced",
    ]),
    true,
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_email_suppressions")).rows
      .length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select * from agentstack.kryx_task_events where type='email.bounced'",
      )
    ).rows.length,
    1,
  );
  await db.close();
});
test("webhook signatures bind exact body, ID and timestamp", () => {
  const secret = "whsec_" + Buffer.from("a".repeat(32)).toString("base64"),
    webhook = new Webhook(secret),
    time = new Date(),
    body = JSON.stringify({ type: "email.bounced" }),
    id = "evt";
  const headers = {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(time.getTime() / 1000)),
    "webhook-signature": webhook.sign(id, time, body),
  };
  assert.equal(webhook.verify(body, headers).type, "email.bounced");
  assert.throws(() => webhook.verify(body + " ", headers));
});
test("untested recordings and adapters cannot enable production secret access", () => {
  const draft = draftTeachingSkill({ name: "Teach", pages: [] });
  assert.equal(draft.state, "DRAFT");
  const adapter = {
    name: "Read analytics",
    description: "Read",
    documentation_url: "https://docs.example",
    version: 1,
    state: "DRAFT",
    allowed_domains: ["api.example"],
    actions: [
      {
        name: "analytics.read",
        method: "GET",
        url: "https://api.example/report",
        risk: "READ",
        inputs_schema: {},
      },
    ],
  };
  assert.equal(adapterSecretAccess(adapter), false);
  assert.throws(() => installAdapter(adapter, true));
});
test("parallel ready tasks respect capacity and do not starve another account", async () => {
  const db = await database(),
    g = await create(db),
    root = await call(db, "kryx_claim_task");
  const graph = {
    title: "Parallel",
    steps: ["a", "b", "c"].map((key) => ({ ...plan.steps[0], key })),
  };
  await call(db, "kryx_save_plan", [root.id, root.lease_token, graph]);
  await call(db, "kryx_control", [user, g, "start"]);
  assert(await call(db, "kryx_claim_task"));
  assert(await call(db, "kryx_claim_task"));
  await call(db, "kryx_create_goal", [
    other,
    "Another account",
    {},
    100,
    "other",
  ]);
  const next = await call(db, "kryx_claim_task");
  assert.equal(next.user_id, other);
  await db.close();
});
