import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, readdirSync } from "node:fs";
const exec = promisify(execFile);
// Never use this fixture against a linked/customer database.
if (
  process.env.KRYX_POSTGRES_TEST !== "1" ||
  process.env.PGDATABASE !== "kryx_operator_test"
)
  throw new Error(
    "Use the dedicated kryx_operator_test database and KRYX_POSTGRES_TEST=1",
  );
async function sql(query) {
  const result = await exec(
    "psql",
    ["-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", query],
    { timeout: 30000, maxBuffer: 1000000 },
  );
  return result.stdout.trim();
}
const literal = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const call = (name, args = []) =>
  sql(
    "select agentstack." +
      name +
      "(" +
      args
        .map((v) =>
          typeof v === "boolean"
            ? String(v)
            : literal(typeof v === "object" ? JSON.stringify(v) : v),
        )
        .join(",") +
      ")",
  );
await sql(readFileSync("tests/operator/base.sql", "utf8"));
for (const file of readdirSync("supabase/migrations")
  .filter((f) => /_kryx_(operator|tool_adapters)\.sql$/.test(f))
  .sort())
  await sql(readFileSync("supabase/migrations/" + file, "utf8"));
await sql(
  "insert into agentstack.profiles(id,credit_balance) values(" +
    literal(owner) +
    ",1000),(" +
    literal(other) +
    ",1000)",
);
await Promise.all(
  Array.from({ length: 12 }, (_, i) =>
    call("kryx_create_goal", [
      i < 8 ? owner : other,
      "Concurrent worker goal " + i,
      {},
      1000,
      "concurrent-" + i,
    ]),
  ),
);
const claims = await Promise.all(
  Array.from({ length: 12 }, () =>
    sql(
      "begin; select agentstack.kryx_claim_task(); select pg_sleep(0.1); commit;",
    ),
  ),
);
const tasks = claims.map((s) => (s ? JSON.parse(s) : null)).filter(Boolean);
assert.equal(tasks.length, 4, "two running workers per owner");
assert.equal(
  new Set(tasks.map((t) => t.id)).size,
  4,
  "a task can have only one live claim",
);
assert.equal(tasks.filter((t) => t.user_id === owner).length, 2);
assert.equal(tasks.filter((t) => t.user_id === other).length, 2);
assert.equal(
  Number(
    await sql(
      "select count(*) from agentstack.kryx_task_runs where status='RUNNING'",
    ),
  ),
  4,
);
console.log(
  "PASS: 12 independent claim sessions preserve capacity, isolation and unique leases.",
);

const owned = tasks.filter((t) => t.user_id === owner),
  t = owned[0];
const reservations = await Promise.all(
  Array.from({ length: 8 }, () =>
    call("kryx_reserve_tool", [
      t.id,
      t.lease_token,
      "same-read",
      "adapter.read",
      "qa-api",
      {},
      5,
    ]),
  ),
);
assert.equal(new Set(reservations.map((s) => JSON.parse(s).id)).size, 1);
assert.equal(
  Number(
    await sql(
      "select credit_balance from agentstack.profiles where id=" +
        literal(owner),
    ),
  ),
  995,
);
assert.equal(
  Number(
    await sql(
      "select count(*) from agentstack.credit_events where user_id=" +
        literal(owner),
    ),
  ),
  1,
);
console.log(
  "PASS: simultaneous identical tool reservations debit one wallet/ledger entry.",
);

const spend = await Promise.allSettled(
  owned.map((task, i) =>
    call("kryx_reserve_tool", [
      task.id,
      task.lease_token,
      "expensive-" + i,
      "model.complete",
      "qa-model",
      {},
      600,
    ]),
  ),
);
assert.equal(spend.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(spend.filter((r) => r.status === "rejected").length, 1);
assert.equal(
  Number(
    await sql(
      "select credit_balance from agentstack.profiles where id=" +
        literal(owner),
    ),
  ),
  395,
);
assert.equal(
  Number(
    await sql(
      "select count(*) from agentstack.credit_events where user_id=" +
        literal(owner),
    ),
  ),
  2,
);
console.log("PASS: competing goals cannot overdraw the owner's wallet.");

const approval = await sql(
  "insert into agentstack.kryx_approvals(user_id,goal_id,task_id,action,risk,payload,fingerprint,status) values(" +
    literal(owner) +
    "," +
    literal(t.goal_id) +
    "," +
    literal(t.id) +
    ",'email.send','EXTERNAL_COMMUNICATION','{}','approved-exact','APPROVED') returning id",
);
const consumers = await Promise.allSettled(
  Array.from({ length: 10 }, () =>
    call("kryx_consume_approval", [owner, approval, "approved-exact"]),
  ),
);
assert.equal(consumers.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(
  Number(
    await sql(
      "select count(*) from agentstack.kryx_tool_runs where idempotency_key=" +
        literal("approval:" + approval),
    ),
  ),
  1,
);
console.log(
  "PASS: 10 approval consumers create exactly one irreversible-action reservation.",
);

await sql(
    "update agentstack.kryx_tasks set priority=999,lease_until=now()-interval '1 second' where id=" +
    literal(t.id),
);
const reclaimed = JSON.parse(await call("kryx_claim_task"));
assert.equal(reclaimed.id, t.id);
assert.notEqual(reclaimed.lease_token, t.lease_token);
await assert.rejects(call("kryx_finish", [t.id, t.lease_token, {}, []]));
await call("kryx_control", [owner, t.goal_id, "pause"]);
await assert.rejects(
  call("kryx_finish", [reclaimed.id, reclaimed.lease_token, {}, []]),
);
console.log("PASS: expired and paused workers cannot commit stale completion.");

const unprotected = await sql(
  "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='agentstack' and c.relname like 'kryx_%' and c.relkind='r' and not c.relrowsecurity",
);
assert.equal(Number(unprotected), 0);
await assert.rejects(
  sql(
    "set role authenticated; select * from agentstack.kryx_adapter_credentials",
  ),
);
await assert.rejects(
  sql(
    "set role authenticated; select agentstack.kryx_install_adapter(" +
      literal(owner) +
      ",gen_random_uuid(),'hash',true)",
  ),
);
console.log(
  "PASS: RLS covers all operator tables; browser roles cannot access the vault or installation RPC.",
);
