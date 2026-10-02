import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { database, call, user } from "./database.mjs";
import { SqlStore } from "./sql-store.ts";
import { fixtureOperator } from "./fixtures.ts";
mkdirSync(".operator-qa", { recursive: true });
await build({
  entryPoints: ["tests/operator/preview-entry.tsx"],
  outfile: ".operator-qa/app.js",
  bundle: true,
  format: "esm",
  jsx: "automatic",
  plugins: [
    {
      name: "next-qa-shims",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: args.path,
          namespace: "qa",
        }));
        b.onLoad({ filter: /.*/, namespace: "qa" }, (args) => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents:
            args.path === "next/link"
              ? `import React from 'react';export default function Link({href,children,prefetch,...props}){return <a href={href} {...props}>{children}</a>}`
              : `export function usePathname(){return location.pathname};export function useRouter(){return {push(p){location.href=p},refresh(){location.reload()},prefetch(){}}}`,
        }));
      },
    },
  ],
});
const db = await database(".operator-qa/database-" + randomUUID()),
  store = new SqlStore(db),
  op = fixtureOperator(store);
let ticking = false;
setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await op.tick();
  } catch (e) {
    console.error(e);
  } finally {
    ticking = false;
  }
}, 500);
const reply = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};
createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  try {
    if (!u.pathname.startsWith("/api/")) {
      if (u.pathname === "/app.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        return res.end(readFileSync(".operator-qa/app.js"));
      }
      if (u.pathname === "/style.css") {
        res.writeHead(200, { "content-type": "text/css" });
        return res.end(readFileSync("apps/web/src/app/operator.css"));
      }
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;font-family:Arial;background:#fafafa;color:#17191c}*{box-sizing:border-box}button,input,textarea{font:inherit}a{text-decoration:none}h1,h2,h3,p{margin:0} @media(max-width:640px){aside{display:none}}</style><div id="root"></div><script type="module" src="/app.js"></script>',
      );
    }
    const data = async () => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      return JSON.parse(Buffer.concat(chunks).toString() || "{}");
    };
    const path = u.pathname.split("/").slice(3),
      kind = path[0],
      id = path[1];
    if (kind === "goals" && !id && req.method === "POST") {
      const b = await data();
      const goal = await call(db, "kryx_create_goal", [
        user,
        b.objective,
        b.context,
        b.budget,
        b.idempotency_key,
      ]);
      return reply(res, 202, { id: goal });
    }
    if (kind === "goals" && !id)
      return reply(res, 200, {
        goals: (
          await db.query(
            "select * from agentstack.kryx_goals where user_id=$1 order by created_at desc",
            [user],
          )
        ).rows,
      });
    if (kind === "goals" && id) {
      if (req.method === "PATCH") {
        const b = await data();
        if (b.action === "edit")
          await call(db, "kryx_edit_plan", [user, id, b.plan]);
        else await call(db, "kryx_control", [user, id, b.action]);
        return reply(res, 200, { ok: true });
      }
      const goal = (
        await db.query(
          "select * from agentstack.kryx_goals where id=$1 and user_id=$2",
          [id, user],
        )
      ).rows[0];
      const rows = await Promise.all(
        [
          "tasks",
          "artifacts",
          "approvals",
          "task_events",
          "tool_runs",
          "computer_sessions",
        ].map(async (k) => [k, await store.rows(k, user, id)]),
      );
      return reply(res, 200, { goal, ...Object.fromEntries(rows) });
    }
    if (kind === "approvals" && req.method === "POST") {
      await call(db, "kryx_decide_approval", [
        user,
        id,
        (await data()).decision,
      ]);
      return reply(res, 200, { ok: true });
    }
    if (kind === "resources") {
      const k = u.searchParams.get("kind");
      if (
        ![
          "routines",
          "skills",
          "memories",
          "artifacts",
          "task_events",
          "computer_sessions",
          "approval_rules",
        ].includes(k)
      )
        throw new Error("Unknown resource");
      return reply(res, 200, { rows: await store.rows(k, user) });
    }
    if (kind === "artifacts") {
      const a = (
        await db.query(
          "select * from agentstack.kryx_artifacts where id=$1 and user_id=$2",
          [id, user],
        )
      ).rows[0];
      res.writeHead(200, {
        "content-type": "text/plain",
        "content-disposition": 'attachment; filename="' + a.name + '"',
      });
      return res.end(a.content);
    }
    return reply(res, 404, { error: "Not found" });
  } catch (e) {
    reply(res, 400, { error: e.message });
  }
}).listen(4173, "127.0.0.1", () => console.log("Kryx QA server ready"));
