import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  fingerprint,
  redact,
  routeTool,
  nextRoutine,
} from "../../apps/web/src/lib/operator/policy.ts";
import {
  validatePlan,
  validateModelOutput,
  qualifyLeads,
  csv,
} from "../../apps/web/src/lib/operator/contracts.ts";
import { privateAddress } from "../../apps/web/src/lib/operator/network.ts";
test("registered action policy defaults and explicit denial", () => {
  assert.equal(decide("email.send"), "ASK");
  assert.equal(decide("web.read"), "ALLOW");
  assert.equal(decide("unknown", "ALLOW"), "DENY");
  assert.equal(decide("purchase", "DENY"), "DENY");
});
test("payload approval is canonical and detects changes", () => {
  assert.equal(
    fingerprint("a", { a: 1, b: 2 }),
    fingerprint("a", { b: 2, a: 1 }),
  );
  assert.notEqual(
    fingerprint("send", { to: "a" }),
    fingerprint("send", { to: "b" }),
  );
});
test("secrets cannot survive nested artifact sanitization", () => {
  const x = JSON.stringify(
    redact(
      {
        api_key: "secret",
        nested: [
          {
            text: "Bearer longtoken",
            password: "pw",
            key: "brand_voice",
            value: "actualsecret",
          },
        ],
      },
      ["actualsecret"],
    ),
  );
  assert(!x.includes("actualsecret"));
  assert(!x.includes("longtoken"));
  assert(x.includes("brand_voice"));
});
test("DAG rejects cycle, unknown dependencies, duplicate keys", () => {
  const step = {
    key: "a",
    title: "A",
    objective: "A",
    operation: "research",
    depends_on: [],
    inputs: {},
  };
  assert.throws(() => validatePlan({ title: "p", steps: [step, step] }));
  assert.throws(() =>
    validatePlan({ title: "p", steps: [{ ...step, depends_on: ["a"] }] }),
  );
  assert.throws(() =>
    validatePlan({ title: "p", steps: [{ ...step, depends_on: ["b"] }] }),
  );
  assert.equal(validatePlan({ title: "p", steps: [step] }).steps.length, 1);
});
test("router chooses connector then API then browser and prefers owned credentials", () => {
  const p = (id, kind, userOwned) => ({
    id,
    kind,
    capabilities: ["read"],
    available: true,
    userOwned,
    cost: 0,
  });
  assert.equal(
    routeTool("read", [
      p("browser", "browser", true),
      p("platform", "api", false),
      p("mine", "api", true),
    ])?.id,
    "mine",
  );
  assert.equal(routeTool("read", []), null);
});
test("routine timezone and DST do not shift wall clock", () => {
  assert.equal(
    nextRoutine(
      {
        hour: 9,
        minute: 0,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        timezone: "Asia/Kolkata",
      },
      new Date("2026-10-02T02:00:00Z"),
    ),
    "2026-10-02T03:30:00.000Z",
  );
  assert.equal(
    nextRoutine(
      {
        hour: 9,
        minute: 0,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        timezone: "America/New_York",
      },
      new Date("2026-11-01T10:00:00Z"),
    ),
    "2026-11-01T14:00:00.000Z",
  );
});
test("SSRF blocks internal, IPv4-mapped and metadata addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::ffff:127.0.0.1",
    "::1",
    "172.16.1.1",
  ])
    assert(privateAddress(ip));
  assert(!privateAddress("8.8.8.8"));
});
test("lead qualification requires exact names, launch dates, quote and dedupes products", () => {
  const lead = {
    name: "Alice",
    product: "Foundry",
    product_url: "https://foundry.example",
    founder_url: "https://foundry.example/alice",
    source_url: "https://source.example",
    launched_at: "2026-10-01",
    quote: "Alice launched Foundry on 2026-10-01",
    score: 80,
    reason: "Fit",
    email: "alice@foundry.example",
  };
  const sources = [
    { url: lead.source_url, text: lead.quote, retrieved_at: "2026-10-02" },
  ];
  const result = qualifyLeads(
    [lead, lead, { ...lead, quote: "Invented story" }],
    sources,
    new Date("2026-10-02"),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].email, null);
  assert.equal(
    qualifyLeads(
      [{ ...lead, launched_at: "2025-01-01" }],
      sources,
      new Date("2026-10-02"),
    ).length,
    0,
  );
});
test("CSV neutralizes spreadsheet formula injection", () =>
  assert(csv([{ name: '=HYPERLINK("evil")' }]).includes("'=HYPERLINK")));

test("invalid structured model responses cannot be cached as successful work", () => {
  assert.throws(() =>
    validateModelOutput(
      "Return JSON {drafts:[{index,subject,text}]}",
      "not JSON",
    ),
  );
  assert.throws(() =>
    validateModelOutput(
      "Return JSON {drafts:[{index,subject,text}]}",
      JSON.stringify({ drafts: [{ index: 0, text: "missing subject" }] }),
    ),
  );
  assert.equal(
    validateModelOutput("Write a report", "# Evidence"),
    "# Evidence",
  );
});

test("numeric token accounting survives redaction while access tokens do not", () => {
  assert.deepEqual(redact({ prompt_tokens: 42, total_tokens: 60, access_token: "private" }),
    { prompt_tokens: 42, total_tokens: 60, access_token: "[REDACTED]" });
});
test("inherited object keys are never registered actions", () => {
  assert.equal(decide("toString", "ALLOW"), "DENY");
  assert.equal(decide("__proto__", "ALLOW"), "DENY");
});
