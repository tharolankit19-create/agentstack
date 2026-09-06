import { classify, lanes, attemptOrder } from "../src/lib/providers";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`);
  if (!cond) failures += 1;
};

check("401 retires the provider", classify(401) === "retire");
check("402 (unpaid) retires the provider", classify(402) === "retire");
check("403 retires the provider", classify(403) === "retire");
check("429 does NOT retire — rate limits are per model", classify(429) === "next");
check("404 (model gone) tries the next model", classify(404) === "next");
check("500/503 (busy) tries the next", classify(503) === "next" && classify(500) === "next");

// Simulate the loop: gemini rate-limits every model, requesty's key is dead,
// orca answers. The request must land on orca and must not waste calls on
// requesty's remaining models.
process.env.GEMINI_API_KEY = "k-gemini";
process.env.REQUESTY_API_KEY = "k-requesty";
process.env.ORCA_API_KEY = "k-orca";

const attempts = attemptOrder(lanes(), null);
const dead = new Set<string>();
const tried: string[] = [];
let answeredBy: string | null = null;

for (const { lane, model } of attempts) {
  if (dead.has(lane.provider.id)) continue;
  tried.push(`${lane.provider.id}/${model}`);
  const status =
    lane.provider.id === "gemini" ? 429 : lane.provider.id === "requesty" ? 401 : 200;
  if (status === 200) { answeredBy = lane.provider.id; break; }
  if (classify(status) === "retire") dead.add(lane.provider.id);
}

check("the request is answered, not failed", answeredBy === "orca", String(answeredBy));
check(
  "every rate-limited gemini model was tried",
  tried.filter((t) => t.startsWith("gemini/")).length === 3,
  String(tried.filter((t) => t.startsWith("gemini/")).length),
);
check(
  "the dead-key provider cost exactly one call, not four",
  tried.filter((t) => t.startsWith("requesty/")).length === 1,
  String(tried.filter((t) => t.startsWith("requesty/")).length),
);
check("orca answered on its first model", tried[tried.length - 1] === "orca/deepseek/deepseek-v4-flash-free", tried[tried.length - 1]);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
