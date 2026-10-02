import { test } from "node:test";
import assert from "node:assert/strict";
import { blocked, authenticated, validateUrl } from "./security.mjs";
test("runtime blocks private and metadata addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "192.168.1.1",
  ])
    assert.equal(blocked(ip), true);
  assert.equal(blocked("8.8.8.8"), false);
});
test("runtime requires exact strong token", () => {
  const token = "a".repeat(32);
  assert.equal(
    authenticated({ headers: { authorization: "Bearer " + token } }, token),
    true,
  );
  assert.equal(
    authenticated(
      { headers: { authorization: "Bearer " + token + "a" } },
      token,
    ),
    false,
  );
});
test("runtime rejects unsigned domains and non HTTPS", async () => {
  await assert.rejects(
    validateUrl("http://example.com", new Set(["example.com"])),
  );
  await assert.rejects(
    validateUrl("https://other.example", new Set(["example.com"])),
  );
  await assert.rejects(
    validateUrl("https://127.0.0.1", new Set(["127.0.0.1"])),
  );
});
