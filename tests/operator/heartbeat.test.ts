import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "../../apps/web/src/lib/heartbeat.ts";
const worker = {
  name: "operator",
  everyMinutes: 1,
  does: "advances durable work",
};
test("heartbeat confirms only successful worker acknowledgements, not HTTP errors or timeouts", async () => {
  const original = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-key-no-customer-secret";
  let response: Response | Error = new Response(null, { status: 202 });
  const fetched = mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: any) => {
      assert.equal(options.redirect, "error");
      assert.equal(
        options.headers.authorization,
        "Bearer " + process.env.CRON_SECRET,
      );
      if (response instanceof Error) throw response;
      return response;
    },
  );
  try {
    assert.equal(
      (await dispatch("https://app.example", worker)).outcome,
      "ran",
    );
    response = new Response(null, { status: 401 });
    const denied = await dispatch("https://app.example", worker);
    assert.equal(denied.outcome, "failed");
    assert.match(denied.error || "", /HTTP 401/);
    response = Object.assign(new Error("timeout"), { name: "AbortError" });
    const timeout = await dispatch("https://app.example", worker);
    assert.equal(timeout.outcome, "failed");
    assert.match(timeout.error || "", /unconfirmed/);
    response = new Error(process.env.CRON_SECRET);
    const failure = await dispatch("https://app.example", worker);
    assert(!JSON.stringify(failure).includes(process.env.CRON_SECRET));
    assert.equal(failure.outcome, "failed");
  } finally {
    fetched.mock.restore();
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});
