// Public API smoke, with no customer credentials or external writes.
import assert from "node:assert/strict";
import { adapterJson } from "../../apps/web/src/lib/operator/adapter-http.ts";
const data = await adapterJson(
  "https://api.github.com/repos/tharolankit19-create/agentstack",
);
assert.equal(data.full_name, "tharolankit19-create/agentstack");
console.log(
  "PASS: pinned public HTTPS transport returned the actual Kryx repository JSON.",
);
