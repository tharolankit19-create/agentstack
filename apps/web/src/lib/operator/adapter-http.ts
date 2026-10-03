import "server-only";
import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { privateAddress } from "./network";

// Pin a verified address for the actual TLS connection. Never follow redirects.
export async function adapterJson(
  url: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const u = new URL(url),
    host = u.hostname.replace(/^\[|\]$/g, "");
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443")
  )
    throw new Error("Only public HTTPS API endpoints are allowed");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address)))
    throw new Error("Private network access denied");
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      u,
      {
        method: "GET",
        agent: false,
        family: chosen.family,
        headers: {
          accept: "application/json",
          "accept-encoding": "identity",
          "user-agent": "KryxAI/1.0",
          ...headers,
        },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
        lookup: (_hostname, _options, cb) =>
          cb(null, chosen.address, chosen.family),
      },
      (res) => {
        if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
          res.resume();
          reject(new Error("API returned " + res.statusCode));
          return;
        }
        if (
          !/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(
            String(res.headers["content-type"]),
          )
        ) {
          res.resume();
          reject(new Error("API did not return JSON"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 256000) {
            res.destroy();
            reject(new Error("API response exceeds 256 KB"));
          } else chunks.push(Buffer.from(chunk));
        });
        res.on("error", () => reject(new Error("API response interrupted")));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new Error("API returned invalid JSON"));
          }
        });
      },
    );
    req.on("error", () =>
      reject(new Error("API connection failed or timed out")),
    );
    req.end();
  });
}
