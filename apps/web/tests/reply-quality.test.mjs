// The filter that decides whether a model's reply is usable.
//
// Copied from `looksUnusable` in src/lib/chat-model.ts. These are the exact
// failure shapes that were reaching founders: the agent reciting its own
// instructions, and the agent narrating a plan instead of doing the work.

function looksUnusable(text) {
  const t = text.trim();
  if (t.length < 25) return true;
  if (/<\|tool_call|tool_call_start|<\|python_tag\|>/i.test(t)) return true;
  if (/^\s*\[?\s*(?:google|search|browse|web_search)\s*\(/i.test(t)) return true;
  if (/^(i (don'?t|do not) have|i cannot|i can'?t) (access|browse|search)/i.test(t)) return true;
  const leaks = ["how you talk:", "what you can actually do:", "what you never do:",
    "you are the founder's", "style contract", "system prompt", "your persona",
    "how you do your job:", "what you already know",
    "live research you just went and pulled", "presentation rules",
    "[you are in the team room"];
  const head = t.toLowerCase().slice(0, 600);
  if (leaks.some((p) => head.includes(p))) return true;
  if (/^(here'?s (my|the) (thinking|plan|approach)|let me (think|break)|i'?ll start by|first,? i (will|'ll) )/i.test(t)) return true;
  return false;
}

let bad = 0;
const t = (label, cond, got) => { console.log((cond ? "PASS  " : "FAIL  ") + label + (cond ? "" : "  <- " + got)); if (!cond) bad++; };

// --- rejected: the reported failures ---
t("rejects the prompt handed back",
  looksUnusable("How you talk:\n- Sound like a real person on the team, texting a busy founder."));
t("rejects a persona dump",
  looksUnusable("You are the founder's chief of staff. Dry, fast, and a little blunt about things."));
t("rejects the room instruction leaking",
  looksUnusable("[You are in the team room. Your squad: @Wren, @Rook. Answer in one or two lines.]"));
t("rejects narrating a plan",
  looksUnusable("Here's my thinking process for finding these leads. First I would define the ICP..."));
t("rejects 'let me think through this'",
  looksUnusable("Let me think through what you're asking for here before I give you an answer."));
t("rejects 'I'll start by'",
  looksUnusable("I'll start by researching the market and then move on to the competitor set."));
t("rejects a tool call",
  looksUnusable("web_search(query=\"dental practice owners texas\")"));
t("rejects 'I can't browse'",
  looksUnusable("I don't have access to the web, so I cannot look at that page for you today."));
t("rejects an empty-ish reply", looksUnusable("ok"));

// --- accepted: real work must not be caught ---
t("accepts a real lead list",
  !looksUnusable("Found 12. Best three: Priya Raman at Elmwood Dental (6 chairs, hiring a treatment coordinator), Sam Okafor at Northgate, and Lena Voss at Bright Smile."));
t("accepts a short human answer",
  !looksUnusable("Your pricing page answers 'what does it cost' below the fold. I rewrote the opener — want me to push it?"));
t("accepts an answer that mentions talking",
  !looksUnusable("I talked to Rook about this and he says the list is thin this week. Worth widening to Leeds?"));
t("accepts an honest fetch failure",
  !looksUnusable("I tried competitor.com and it blocked me. Want me to try their blog subdomain instead?"));
t("accepts a draft that discusses a plan mid-sentence",
  !looksUnusable("The launch plan is solid but the timing is wrong. Here's my thinking: ship the pricing change first."));

console.log(bad === 0 ? "\nALL PASS" : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
