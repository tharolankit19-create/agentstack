import { createServer } from "node:http";
import { createHash, createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { authenticated, body, response } from "./security.mjs";
const exec = promisify(execFile),
  token = process.env.KRYX_COMPUTER_API_KEY;
if (!token || token.length < 32) throw new Error("Strong broker key required");
const image = process.env.KRYX_COMPUTER_IMAGE || "kryx-computer:local",
  network = process.env.KRYX_COMPUTER_NETWORK || "kryx-computer-internal",
  domains = process.env.KRYX_ALLOWED_DOMAINS || "[]";
if (!JSON.parse(domains).length) throw new Error("Domain allowlist required");
const sessions = new Map(),
  locks = new Map();
async function docker(args) {
  try {
    return (await exec("docker", args, { timeout: 45000, maxBuffer: 1000000 })).stdout.trim();
  } catch {
    // Docker arguments include runtime credentials. Never return child-process errors.
    throw new Error("Computer container operation failed. Inspect the runtime host.");
  }
}
async function session(workspace) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(workspace))
    throw new Error("Invalid workspace");
  const hash = createHash("sha256")
      .update(workspace)
      .digest("hex")
      .slice(0, 32),
    name = "kryx-" + hash,
    secret = createHmac("sha256", token).update(name).digest("hex");
  const existing = sessions.get(name);
  if (existing) {
    existing.at = Date.now();
    return existing;
  }
  let inspect;
  try {
    inspect = JSON.parse(await docker(["inspect", name]))[0];
  } catch {}
  if (inspect && inspect.Config.Labels?.["kryx.owner"] !== hash)
    throw new Error("Container ownership mismatch");
  if (
    inspect &&
    !inspect.Config.Env?.includes("KRYX_RUNTIME_TOKEN=" + secret)
  ) {
    await docker(["rm", "-f", name]);
    inspect = null;
  }
  if (inspect) {
    if (inspect.Config.Labels?.["kryx.owner"] !== hash)
      throw new Error("Container ownership mismatch");
    if (!inspect.State.Running) await docker(["start", name]);
  } else {
    const volume = "kryx-workspace-" + hash;
    await docker(["volume", "create", volume]);
    // Resolve ownership inside the actual runtime image. Ubuntu/Playwright
    // images do not guarantee pwuser has UID 1000.
    await docker([
      "run", "--rm", "--network", "none", "--user", "root",
      "--read-only", "--cap-drop=ALL", "--cap-add=CHOWN", "--cap-add=FOWNER",
      "--security-opt", "no-new-privileges", "--pids-limit", "32",
      "--memory", "128m", "--entrypoint", "/bin/sh",
      "--mount", `type=volume,src=${volume},dst=/data`,
      image, "-c", 'chown "$(id -u pwuser):$(id -g pwuser)" /data && chmod 700 /data',
    ]);
    await docker([
      "run",
      "-d",
      "--name",
      name,
      "--label",
      "kryx.owner=" + hash,
      "--label",
      "kryx.runtime=true",
      "--network",
      network,
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt",
      "no-new-privileges",
      "--security-opt",
      "seccomp=/app/seccomp_profile.json",
      "--pids-limit",
      "128",
      "--cpus",
      "1",
      "--memory",
      "1g",
      "--shm-size",
      "256m",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,size=256m",
      "--mount",
      `type=volume,src=${volume},dst=/workspace`,
      "-e",
      "KRYX_RUNTIME_TOKEN=" + secret,
      "-e",
      "KRYX_ALLOWED_DOMAINS=" + domains,
      image,
    ]);
  }
  const s = { name, secret, at: Date.now() };
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch("http://" + name + ":8081/health", {
        headers: { authorization: "Bearer " + secret },
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        sessions.set(name, s);
        return s;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Computer container did not become healthy");
}
createServer(async (req, res) => {
  if (!authenticated(req, token))
    return response(res, 401, { error: "Unauthorized" });
  try {
    if (req.url === "/health") {
      await docker(["info", "--format", "{{.ServerVersion}}"]);
      return response(res, 200, { ready: true });
    }
    if (
      req.method !== "POST" ||
      !["/capture", "/terminal", "/files", "/list"].includes(req.url)
    )
      return response(res, 404, { error: "Unknown computer action" });
    const input = await body(req);
    if (locks.has(input.workspace))
      return response(res, 409, { error: "Workspace busy" });
    locks.set(input.workspace, true);
    try {
      const s = await session(input.workspace);
      const r = await fetch("http://" + s.name + ":8081" + req.url, {
        method: "POST",
        headers: {
          authorization: "Bearer " + s.secret,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(90000),
      });
      const data = await r.json();
      return response(res, r.status, data);
    } finally {
      locks.delete(input.workspace);
    }
  } catch (e) {
    return response(res, 503, {
      error: e instanceof Error ? e.message : "Computer unavailable",
    });
  }
}).listen(8090, "0.0.0.0");
setInterval(() => {
  for (const [name, s] of sessions)
    if (Date.now() - s.at > 3600000 && !locks.size) {
      sessions.delete(name);
      void docker(["rm", "-f", name]).catch(() => {});
    }
}, 60000).unref();
