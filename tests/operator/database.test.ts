import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, call, create, user, other, plan } from "./database.mjs";
async function prepared(db) {
  const g = await create(db);
  const t = await call(db, "kryx_claim_task");
  await call(db, "kryx_save_plan", [t.id, t.lease_token, plan]);
  await call(db, "kryx_control", [user, g, "start"]);
  return { g, t };
}
test("migration, plan checkpoint and dependent artifacts survive process restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kryx-db-"));
  let db = await database(dir);
  const { g } = await prepared(db);
  const task = await call(db, "kryx_claim_task");
  assert.equal(task.operation, "research");
  await call(db, "kryx_finish", [
    task.id,
    task.lease_token,
    { summary: "Real evidence" },
    [
      {
        name: "evidence.md",
        type: "markdown",
        content: "verified",
        sources: [],
      },
    ],
  ]);
  await db.close();
  db = await database(dir);
  assert.equal(
    (await db.query("select content from agentstack.kryx_artifacts")).rows[0]
      .content,
    "verified",
  );
  assert.equal((await call(db, "kryx_claim_task")).operation, "qualify");
  assert.equal(
    (await db.query("select id from agentstack.kryx_goals")).rows[0].id,
    g,
  );
  await db.close();
  await rm(dir, { recursive: true, force: true });
});
test("owner-only RLS and backend-only task mutations", async () => {
  const db = await database();
  await create(db);
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${other}',false)`,
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_goals")).rows.length,
    0,
  );
  await assert.rejects(
    db.exec("update agentstack.kryx_goals set status='COMPLETED'"),
  );
  await assert.rejects(
    call(db, "kryx_create_goal", [other, "Forged", {}, 100, "forged"]),
  );
  await db.exec("reset role;set role anon");
  await assert.rejects(db.exec("select * from agentstack.kryx_goals"));
  await db.close();
});
test("expired worker lease is reclaimed; stale completion and pause are fenced", async () => {
  const db = await database();
  await prepared(db);
  const a = await call(db, "kryx_claim_task");
  await db.query(
    "update agentstack.kryx_tasks set lease_until=now()-interval '1 second' where id=$1",
    [a.id],
  );
  const b = await call(db, "kryx_claim_task");
  assert.notEqual(a.lease_token, b.lease_token);
  await assert.rejects(call(db, "kryx_finish", [a.id, a.lease_token, {}, []]));
  await call(db, "kryx_control", [user, a.goal_id, "pause"]);
  await assert.rejects(call(db, "kryx_finish", [b.id, b.lease_token, {}, []]));
  await db.close();
});
test("approved exact action can execute once and never before approval", async () => {
  const db = await database();
  const { g } = await prepared(db);
  const t = await call(db, "kryx_claim_task");
  const a = await db.query(
    "insert into agentstack.kryx_approvals(user_id,goal_id,task_id,action,risk,payload,fingerprint) values($1,$2,$3,'email.send','EXTERNAL_COMMUNICATION','{}','digest') returning id",
    [user, g, t.id],
  );
  const id = a.rows[0].id;
  await assert.rejects(call(db, "kryx_consume_approval", [user, id, "digest"]));
  await assert.rejects(
    call(db, "kryx_decide_approval", [other, id, "APPROVED"]),
  );
  await call(db, "kryx_decide_approval", [user, id, "APPROVED"]);
  await assert.rejects(
    call(db, "kryx_consume_approval", [user, id, "changed"]),
  );
  assert.equal(
    (await call(db, "kryx_consume_approval", [user, id, "digest"])).status,
    "EXECUTING",
  );
  await assert.rejects(call(db, "kryx_consume_approval", [user, id, "digest"]));
  await db.close();
});
test("cost reservations are atomic and idempotent, memories update rather than duplicate", async () => {
  const db = await database();
  await prepared(db);
  const t = await call(db, "kryx_claim_task");
  const args = [t.id, t.lease_token, "read:1", "web.read", "firecrawl", {}, 3];
  await call(db, "kryx_reserve_tool", args);
  await call(db, "kryx_reserve_tool", args);
  assert.equal(
    (await db.query("select spent from agentstack.kryx_goals")).rows[0].spent,
    3,
  );
  await assert.rejects(
    call(db, "kryx_reserve_tool", [
      t.id,
      t.lease_token,
      "expensive",
      "read",
      "provider",
      {},
      1000,
    ]),
  );
  for (let i = 0; i < 2; i++)
    await call(db, "kryx_remember", [
      user,
      "workspace",
      "STYLE",
      "voice",
      JSON.stringify("short"),
      {},
    ]);
  const rows = (await db.query("select * from agentstack.kryx_memories")).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].times_confirmed, 2);
  await db.close();
});
test("routines are leased once; exhausted and ambiguous work stays visible", async () => {
  const db = await database();
  await db.query(
    "insert into agentstack.kryx_routines(user_id,name,objective,schedule,timezone,next_run) values($1,'daily','Monitor competition','{}','UTC',now()-interval '1 minute')",
    [user],
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_claim_routines()")).rows
      .length,
    1,
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_claim_routines()")).rows
      .length,
    0,
  );
  await prepared(db);
  const t = await call(db, "kryx_claim_task");
  await db.query(
    "update agentstack.kryx_tasks set retry_count=3,lease_until=now()-interval '1 minute' where id=$1",
    [t.id],
  );
  await call(db, "kryx_reconcile");
  assert.equal(
    (
      await db.query("select status from agentstack.kryx_tasks where id=$1", [
        t.id,
      ])
    ).rows[0].status,
    "FAILED",
  );
  await db.close();
});
