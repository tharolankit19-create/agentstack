// Execute against a deployed broker, without bypassing production security controls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.KRYX_COMPUTER_API_URL,
  token = process.env.KRYX_COMPUTER_API_KEY,
  url = process.env.KRYX_SMOKE_URL || "https://example.com";
if (!base || !token)
  throw new Error("Configure a deployed broker and smoke-test credentials");
const workspace = "smoke_" + randomUUID().replaceAll("-", "");
const call = async (path, body) => {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const data = await r.json();
  assert(r.ok, JSON.stringify(data));
  return data;
};
await call("/health");
const captured = await call("/capture", {
  workspace,
  session: workspace,
  url,
  mobile: false,
});
assert(Buffer.from(captured.png, "base64").subarray(1, 4).toString() === "PNG");
assert(captured.text?.length > 0);
const denied = await fetch(base + "/capture", {
  method: "POST",
  headers: {
    authorization: "Bearer " + token,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    workspace,
    session: workspace,
    url: "https://169.254.169.254",
    mobile: false,
  }),
  signal: AbortSignal.timeout(20000),
});
assert(!denied.ok, "Metadata access must fail");
console.log("Production broker capture and egress denial passed");
