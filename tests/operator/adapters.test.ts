import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adapterManifest,
  adapterHash,
  adapterRequest,
  installAdapter,
  adapterSecretAccess,
  sandboxAdapter,
} from "../../apps/web/src/lib/operator/adapters.ts";
import { adapterJson } from "../../apps/web/src/lib/operator/adapter-http.ts";
import { database, create, call, user, other } from "./database.mjs";
import { fixtureOperator, fixtureProviders } from "./fixtures.ts";
import { SqlStore } from "./sql-store.ts";
import { Store } from "../../apps/web/src/lib/operator/store.ts";
import { ProductionProviders } from "../../apps/web/src/lib/operator/providers.ts";
import { sealSecrets } from "../../apps/web/src/lib/crypto.ts";
import type { Task } from "../../apps/web/src/lib/operator/contracts.ts";
import { readManifest } from "./adapter-fixture.ts";
test("adapter compiler rejects undeclared inputs, credentials, writes and altered tested definitions", async () => {
  assert.throws(() => adapterRequest(readManifest, "missing", {}));
  assert.throws(() =>
    adapterRequest(readManifest, "repository.read", {
      authorization: "secret",
    }),
  );
  assert.throws(() =>
    adapterRequest(readManifest, "repository.read", { page: "1" }),
  );
  assert.equal(
    new URL(adapterRequest(readManifest, "repository.read", { page: 2 }).url)
      .search,
    "?page=2",
  );
  const tested = await sandboxAdapter(readManifest, {}, async () => ({
    id: 1,
  }));
  assert.equal(adapterSecretAccess(tested.manifest), false);
  const installed = installAdapter(tested.manifest, true);
  assert.equal(adapterSecretAccess(installed), true);
  assert.throws(() =>
    installAdapter({ ...tested.manifest, name: "Changed definition" }, true),
  );
  assert.throws(() => installAdapter(tested.manifest, false));
  const write = {
    ...readManifest,
    actions: [
      { ...readManifest.actions[0], method: "DELETE", risk: "DESTRUCTIVE" },
    ],
  };
  await assert.rejects(
    sandboxAdapter(write, {}, async () => ({})),
    /write actions are blocked/,
  );
  assert.throws(() =>
    adapterManifest.parse({ ...readManifest, code: "execute arbitrary code" }),
  );
  assert.throws(() =>
    adapterManifest.parse({
      ...readManifest,
      authentication: { type: "header", header: "host" },
    }),
  );
});
test("sandbox errors stay failed and no credentials are passed to the HTTP reader", async () => {
  let calls = 0;
  const tested = await sandboxAdapter(
    { ...readManifest, authentication: { type: "bearer" } },
    {},
    async (...args) => {
      calls++;
      assert.equal(args.length, 1);
      throw new Error("API returned 401");
    },
  );
  assert.equal(calls, 1);
  assert.equal(tested.manifest.state, "DRAFT");
  assert.equal(tested.results[0].passed, false);
  assert.match(tested.manifest.sandbox_result.evidence, /401/);
  assert.throws(() => installAdapter(tested.manifest, true));
  await assert.rejects(adapterJson("https://127.0.0.1/"), /Private network/);
  await assert.rejects(
    adapterJson("https://[::ffff:127.0.0.1]/"),
    /Private network/,
  );
  await assert.rejects(
    adapterJson("http://api.github.com/"),
    /Only public HTTPS/,
  );
});
async function proposal(db: any) {
  const store = new SqlStore(db),
    p = fixtureProviders();
  p.read = async () => ({
    url: readManifest.documentation_url,
    text: readManifest.actions[0].url,
    retrieved_at: new Date().toISOString(),
  });
  p.model = async () => JSON.stringify(readManifest);
  const op = fixtureOperator(store, p);
  const goal = await create(db, "Connect a public repository read tool", {
    adapter_request: readManifest.documentation_url,
  });
  await op.tick();
  await call(db, "kryx_control", [user, goal, "start"]);
  await op.tick();
  const row = (await db.query("select * from agentstack.kryx_tool_adapters"))
    .rows[0];
  assert(row);
  assert.equal(row.state, "DRAFT");
  return { row, op, p, store };
}
test("durable discovery, sandbox, exact installation and API reads produce audited artifacts", async () => {
  const db = await database();
  const { row, op, p } = await proposal(db);
  await assert.rejects(
    call(db, "kryx_install_adapter", [user, row.id, row.manifest_hash, true]),
  );
  await assert.rejects(
    call(db, "kryx_adapter_credential", [user, row.id, "encrypted"]),
  );
  p.adapterTest = (manifest, examples) =>
    sandboxAdapter(manifest, examples, async () => ({
      full_name: "QA fixture",
    }));
  const goal = await create(db, "Test repository read without credentials", {
    adapter_test: { adapter_id: row.id, examples: {} },
  });
  await op.tick();
  await call(db, "kryx_control", [user, goal, "start"]);
  await op.tick();
  const tested = (await db.query("select * from agentstack.kryx_tool_adapters"))
    .rows[0];
  assert.equal(tested.state, "TESTED");
  await assert.rejects(
    call(db, "kryx_install_adapter", [other, row.id, row.manifest_hash, true]),
  );
  await assert.rejects(
    call(db, "kryx_install_adapter", [user, row.id, "changed", true]),
  );
  await assert.rejects(
    call(db, "kryx_install_adapter", [user, row.id, row.manifest_hash, false]),
  );
  await call(db, "kryx_install_adapter", [
    user,
    row.id,
    row.manifest_hash,
    true,
  ]);
  await call(db, "kryx_install_adapter", [
    user,
    row.id,
    row.manifest_hash,
    true,
  ]);
  assert.equal(
    (
      await db.query(
        "select * from agentstack.kryx_task_events where type='tool.installed'",
      )
    ).rows.length,
    1,
  );
  p.adapterRead = async () => ({
    url: readManifest.actions[0].url,
    text: JSON.stringify({ full_name: "QA fixture" }),
    retrieved_at: new Date().toISOString(),
  });
  const run = await create(db, "Read the connected repository", {
    adapter_run: {
      adapter_id: row.id,
      action: "repository.read",
      parameters: {},
    },
  });
  await op.tick();
  await call(db, "kryx_control", [user, run, "start"]);
  await op.tick();
  const artifact = (
    await db.query(
      "select * from agentstack.kryx_artifacts where name='connected-api.json'",
    )
  ).rows[0];
  assert.equal(artifact.sources[0].url, readManifest.actions[0].url);
  assert.match(artifact.content, /QA fixture/);
  await call(db, "kryx_adapter_credential", [
    user,
    row.id,
    "v1.encrypted-envelope",
  ]);
  await call(db, "kryx_disable_adapter", [user, row.id]);
  assert.equal(
    (await db.query("select * from agentstack.kryx_adapter_credentials")).rows
      .length,
    0,
  );
  await assert.rejects(
    call(db, "kryx_adapter_credential", [user, row.id, "encrypted"]),
  );
  await db.close();
});
test("adapter definitions are owner-readable but lifecycle and encrypted vault are service-only", async () => {
  const db = await database();
  const { row } = await proposal(db);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    other,
  ]);
  assert.equal(
    (await db.query("select * from agentstack.kryx_tool_adapters")).rows.length,
    0,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  assert.equal(
    (await db.query("select * from agentstack.kryx_tool_adapters")).rows.length,
    1,
  );
  await assert.rejects(
    db.exec("update agentstack.kryx_tool_adapters set state='INSTALLED'"),
  );
  await assert.rejects(
    db.exec("select * from agentstack.kryx_adapter_credentials"),
  );
  await assert.rejects(
    call(db, "kryx_install_adapter", [user, row.id, row.manifest_hash, true]),
  );
  await db.exec("reset role");
  await db.close();
});
test("paused discovery cannot commit a generated adapter or completion artifact", async () => {
  const db = await database(),
    store = new SqlStore(db),
    p = fixtureProviders();
  p.model = async () => JSON.stringify(readManifest);
  const op = fixtureOperator(store, p),
    goal = await create(db, "Connect repository", {
      adapter_request: readManifest.documentation_url,
    });
  await op.tick();
  await call(db, "kryx_control", [user, goal, "start"]);
  const task = await call(db, "kryx_claim_task");
  await call(db, "kryx_control", [user, goal, "pause"]);
  await assert.rejects(
    call(db, "kryx_finish", [
      task.id,
      task.lease_token,
      {
        _adapter_proposal: {
          manifest: readManifest,
          manifest_hash: adapterHash(readManifest),
        },
      },
      [],
    ]),
  );
  assert.equal(
    (await db.query("select * from agentstack.kryx_tool_adapters")).rows.length,
    0,
  );
  await db.close();
});
test("production adapter execution scopes the vault, honors policy, uses headers and redacts echoed credentials", async () => {
  process.env.SECRETS_ENCRYPTION_KEY = "ab".repeat(32);
  const secret = "private-adapter-key-12345678";
  const tested = await sandboxAdapter(
    { ...readManifest, authentication: { type: "bearer" } },
    {},
    async () => ({}),
  );
  const manifest = installAdapter(tested.manifest, true),
    adapterId = "33333333-3333-4333-8333-333333333333";
  let state = "INSTALLED",
    decision = "ALLOW",
    networkCalls = 0;
  const recorded: unknown[] = [];
  const queries: Record<string, unknown> = {};
  const db: any = {
    from(table: string) {
      const q: any = {
        select() {
          return q;
        },
        update() {
          return q;
        },
        eq(k: string, v: unknown) {
          queries[table + ":" + k] = v;
          return q;
        },
        maybeSingle: async () => ({
          data: { ciphertext: sealSecrets({ api_key: secret }) },
          error: null,
        }),
        then(resolve: any) {
          resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
  class TestStore extends Store {
    async rows<T>(table: string, _user: string): Promise<T[]> {
      return (
        table === "approval_rules"
          ? [{ action: "adapter.read", decision }]
          : [
              {
                id: adapterId,
                state,
                manifest,
                manifest_hash: adapterHash(manifest),
              },
            ]
      ) as T[];
    }
    async rpc<T>(_name: string, args: Record<string, unknown>): Promise<T> {
      recorded.push(args);
      return { id: "tool", status: "RUNNING" } as T;
    }
    async event(_t: Task, type: string, data: unknown) {
      recorded.push({ type, data });
    }
    async update(
      _table: string,
      _user: string,
      _id: string,
      value: Record<string, unknown>,
    ) {
      recorded.push(value);
    }
  }
  const task = {
    id: "task",
    goal_id: "goal",
    user_id: user,
    lease_token: "lease",
  } as Task;
  const p = new ProductionProviders(
    new TestStore(db),
    task,
    async (url, headers) => {
      networkCalls++;
      assert.equal(headers?.authorization, "Bearer " + secret);
      assert(!url.includes(secret));
      return { message: "echo " + secret };
    },
  );
  const result = await p.adapterRead(adapterId, "repository.read", { page: 1 });
  assert.equal(queries["kryx_adapter_credentials:user_id"], user);
  assert.equal(queries["kryx_adapter_credentials:adapter_id"], adapterId);
  assert(!result.text.includes(secret));
  assert(!JSON.stringify(recorded).includes(secret));
  decision = "DENY";
  await assert.rejects(
    p.adapterRead(adapterId, "repository.read", {}),
    /denied by workspace/,
  );
  assert.equal(networkCalls, 1);
  state = "DRAFT";
  await assert.rejects(
    p.adapterRead(adapterId, "repository.read", {}),
    /tested adapter not found/,
  );
  assert.equal(networkCalls, 1);
});
