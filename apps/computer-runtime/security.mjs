import { lookup } from "node:dns/promises";
import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
export function blocked(ip) {
  if (ip.includes(":"))
    return !/^2[0-9a-f]{3}:/i.test(ip) || /^2001:(db8|0):/i.test(ip);
  const a = ip.split(".").map(Number);
  return (
    a.length !== 4 ||
    a[0] === 0 ||
    a[0] === 10 ||
    a[0] === 127 ||
    a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && (a[1] === 168 || a[1] === 0 || a[1] === 2)) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 198 && (a[1] === 18 || a[1] === 19 || a[1] === 51)) ||
    (a[0] === 203 && a[1] === 0 && a[2] === 113)
  );
}
export function authenticated(req, token) {
  const input = Buffer.from(req.headers.authorization || ""),
    expected = Buffer.from("Bearer " + token);
  return (
    token?.length >= 32 &&
    input.length === expected.length &&
    timingSafeEqual(input, expected)
  );
}
export async function resolvePublic(host) {
  host = host.replace(/^\[|\]$/g, "");
  const rows = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });
  if (!rows.length || rows.some((r) => blocked(r.address)))
    throw new Error("Private network denied");
  return rows[0].address;
}
export async function validateUrl(input, allowed) {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443")
  )
    throw new Error("Only HTTPS is allowed");
  if (!allowed.has(u.hostname.toLowerCase()))
    throw new Error("Domain needs workspace permission");
  await resolvePublic(u.hostname);
  return u.toString();
}
export async function body(req, max = 50000) {
  let bytes = 0;
  const chunks = [];
  for await (const c of req) {
    bytes += c.length;
    if (bytes > max) throw new Error("Body limit exceeded");
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}
export function response(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}
