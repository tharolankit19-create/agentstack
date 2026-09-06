import { lanes, attemptOrder } from "../src/lib/providers";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`);
  if (!cond) failures += 1;
};

// --- no keys at all ---
const empty = lanes();
check("no keys configured -> empty chain", empty.length === 0, `got ${empty.length}`);
check("no keys -> no attempts", attemptOrder(empty, "someones-key").length === 0);

// --- three providers configured ---
process.env.GEMINI_API_KEY = "k-gemini";
process.env.REQUESTY_API_KEY = "k-requesty";
process.env.ORCA_API_KEY = "k-orca";

const chain = lanes();
check("three keys -> three lanes", chain.length === 3, `got ${chain.length}`);
check(
  "capability order: gemini, requesty, orca",
  chain.map((l) => l.provider.id).join(",") === "gemini,requesty,orca",
  chain.map((l) => l.provider.id).join(","),
);

const order = attemptOrder(chain, null);
check("attempts cover every model of every lane", order.length ===
  chain.reduce((n, l) => n + l.models.length, 0), `got ${order.length}`);
check(
  "a lane is exhausted before the next begins",
  order.slice(0, chain[0].models.length).every((a) => a.lane.provider.id === "gemini"),
);

// --- the caller's own key leads ---
const led = attemptOrder(chain, "k-orca");
check("caller's key leads the chain", led[0].lane.provider.id === "orca", led[0].lane.provider.id);
check(
  "no lane is attempted twice when it leads",
  led.length === order.length,
  `${led.length} vs ${order.length}`,
);
check(
  "the other lanes still follow",
  new Set(led.map((a) => a.lane.provider.id)).size === 3,
);

// --- an unrecognised key rides OpenRouter, and does not duplicate it ---
process.env.OPENROUTER_API_KEY = "k-or";
const withOr = lanes();
const stranger = attemptOrder(withOr, "k-unknown-founder-key");
check("unknown key leads on openrouter", stranger[0].lane.provider.id === "openrouter");
check("unknown key is the one actually sent", stranger[0].lane.apiKey === "k-unknown-founder-key");
check(
  "openrouter is not also appended a second time",
  stranger.filter((a) => a.lane.provider.id === "openrouter").length ===
    withOr.find((l) => l.provider.id === "openrouter")!.models.length,
);

// --- operator overrides ---
process.env.MODEL_PROVIDER_ORDER = "orca,gemini";
check(
  "MODEL_PROVIDER_ORDER reorders and narrows",
  lanes().map((l) => l.provider.id).join(",") === "orca,gemini",
  lanes().map((l) => l.provider.id).join(","),
);
process.env.MODEL_PROVIDER_ORDER = "orca,doesnotexist,gemini";
check("an unknown provider name is skipped, not fatal", lanes().length === 2);
delete process.env.MODEL_PROVIDER_ORDER;

process.env.ORCA_MODELS = "only/this-one";
check("per-provider model override applies",
  lanes().find((l) => l.provider.id === "orca")!.models.join(",") === "only/this-one");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
