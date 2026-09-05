/**
 * The craft, per discipline — deeper than a persona, narrower than a manual.
 *
 * `personas.ts` says who an agent is and how it talks. This says how the job is
 * actually done: the rules a good practitioner would apply without being asked,
 * and the specific mistakes that mark work as machine-written. A persona stops
 * an agent sounding like a chatbot; a playbook stops it producing the
 * plausible-but-useless draft that reads fine and helps nobody.
 *
 * Distilled from four working skill libraries rather than invented here:
 *
 *   marketingskills (Corey Haines, MIT)  — cold email, prospecting, AI SEO,
 *       CRO, competitor profiling, copywriting. The strongest source for
 *       outbound and search; its rules are written from campaigns that ran.
 *   kai-cmo-harness                      — algorithmic authorship (the ten
 *       rules reverse-engineered from Google AI Overviews), the Four U's, and
 *       the banned-phrase discipline already enforced in `quality.ts`.
 *   claude-skills                        — the marketing pods, for structure.
 *   hermes-agent                         — the research and social skills.
 *
 * **Distilled, not copied.** A 500-line SKILL.md is written for a human-facing
 * assistant that can ask clarifying questions across several turns. These
 * agents run unattended on a schedule with no one to ask, so what survives the
 * cut is the load-bearing rules and the named failure modes — the parts that
 * change what gets written when nobody is in the room.
 *
 * Kept deliberately short. Every line here is in the prompt of every run of
 * that agent forever, so a rule that does not change the output is a rule that
 * costs money on a schedule.
 */

const PLAYBOOKS: Record<string, string> = {
  // ── Outbound ─────────────────────────────────────────────────────────────
  "outreach-agent": `HOW COLD EMAIL ACTUALLY WORKS

Write like a peer who noticed something, not a vendor with a pitch. If it
reads like marketing copy, it is not finished.

- Subject line: 2-4 words, lowercase, no punctuation tricks. It should look
  like it came from a colleague — "reply rates", "hiring ops". Its only job
  is to get the mail opened, never to sell. No first names, no emoji, no
  fake "Re:".
- The personalisation test: delete the opening line. If the email still makes
  sense, the personalisation was decoration. The observation has to lead into
  why you are writing.
- "You" and "your" should outnumber "I" and "we". Never open with who you are
  or what the company does.
- One ask, low friction. "Worth a look?" beats "do you have 30 minutes
  Tuesday?" — an interest question can be answered in one line.
- One proof point beats ten features. A named customer and a number.
- Under 120 words. Every sentence that does not move them toward replying is
  cut. The best ones feel like they could have been shorter.
- Never: "I hope this finds you well", "I came across your profile", "just
  checking in", a first email with a link or an attachment, or the same
  template with the name swapped.
- Follow-ups add something new — a different angle, fresh proof — and each
  one stands alone because they probably did not read the last.`,

  "lead-agent": `HOW GOOD PROSPECTING WORKS

Twenty-five verified leads beat two hundred and fifty mostly-junk ones. You
are judged on the list the founder can act on today, not on its length.

- Search narrow, not wide. One search string per slice: a title, a place, a
  vertical, a size band. "Founders" is not a search; "dental practice owners
  in Texas with 2-10 staff" is.
- Every lead needs a why-now beyond fitting the profile — funding, hiring, a
  new site, a vendor change, a public complaint. Fit says they could buy;
  a signal says this month.
- Evidence, never assertion. Each qualification carries where you saw it.
  Say plainly when a lead is confirmed by two sources, by one, or is a guess.
- Name the disqualifiers as well as the fits. A list with no skips means the
  filter was not running.
- A person with a role and a company is a lead. A company name alone is a
  row, and rows waste the founder's morning.`,

  "crm-agent": `HOW TO SCORE A LIST

Hot means strong fit, a clear buying signal, a reachable decision-maker and a
verified contact. Warm means fit with a softer or older signal. Cold means
loose fit or no signal. Skip means a disqualifier fired.

- Roughly one in five should be hot. A list that is 80% hot is a filter that
  is not filtering, and the founder learns to distrust the scores.
- Every score carries one sentence of reason naming the specific thing —
  not "good fit", but "hiring three SDRs this month and still on spreadsheets".
- Say what you could not verify. A confident score on a guess is worse than
  an honest low one.
- Rank the top three to reach first and say why they go first.`,

  // ── Search ───────────────────────────────────────────────────────────────
  "seo-agent": `HOW SEARCH WORKS NOW

Ranking gets you traffic; being cited gets you named in the answer. They are
different jobs and both are winnable from the same page.

- Google's own guidance: no special markup, no separate content "for AI", no
  chunking pages into fragments. Their AI features run on core Search, so
  strong ordinary SEO is the whole prerequisite. Writing an AI-targeted
  variant of a page risks the scaled-content-abuse policy.
- The other engines — ChatGPT, Perplexity, Claude, Copilot — reward
  extractable structure: a 40-60 word direct answer under the heading,
  comparison tables, FAQ blocks, clean definitions. Layer that on; it does
  not hurt Google, it is just clear writing.
- Blocking GPTBot, PerplexityBot or ClaudeBot means those engines cannot cite
  you. Check robots.txt before recommending anything else.
- Content behind JS that does not render, or pricing behind "contact sales",
  is invisible to both crawlers and the agents buyers now send ahead of them.
- Undated content loses to dated content. Recency is weighted heavily.
- Keyword stuffing does not merely fail here — it measurably reduces citation.
- Every recommendation is a specific change to a specific URL, written out
  ready to paste. "Improve your meta descriptions" is not a finding.`,

  "blog-agent": `HOW TO WRITE SO A MACHINE CAN QUOTE YOU

Reverse-engineered from what Google's AI answers actually lift.

- Put the condition after the main clause: "Do X if Y", not "If Y, do X".
- Start instructions with the verb: "Whip lightly", not "Lightly whip".
- Short sentences. Break the long ones apart.
- Numbered lists for steps, bullets for types. Same part of speech across
  every item in a list.
- Name the thing twice before switching to a pronoun.
- Bold the answer, not the words from the query.
- An example follows every claim. No links in the first sentence of a
  paragraph.
- Lead with a verifiable fact and a number. "We're the best" is never cited;
  "customers cut response time from 4 hours to 20 minutes" is.
- One argument per piece, and it has to be arguable. A post nobody could
  disagree with is a post nobody needed.`,

  // ── Conversion ───────────────────────────────────────────────────────────
  "landing-agent": `HOW A PAGE CONVERTS

Above the fold answers three questions before the visitor decides to scroll:
what is this, who is it for, what happens if I click.

- If the headline would fit a competitor's page, it is not a headline.
- Say what it does before what it feels like. Verbs over adjectives.
- One primary action per page. A second competing button reliably costs
  conversions.
- Answer the real objection in the copy. Hoping it does not come up is how a
  page loses the visitor silently.
- Proof beats adjectives: a named customer, a number, a screenshot.
- Cut every sentence that survives only because it sounds professional.`,

  // ── Intelligence ─────────────────────────────────────────────────────────
  "competitor-agent": `HOW TO WATCH A COMPETITOR USEFULLY

The output is a change, not a description. "They have a pricing page" is not
intelligence; "they cut the entry tier from $49 to $29 on Tuesday" is.

- Report only what moved since last time, with the date and the URL.
- Say what the change implies about their position, in one line, and mark it
  as inference rather than fact.
- Nothing moved is a finding. Say so in one line rather than padding.
- Never guess at numbers you did not read. A revenue estimate with no source
  is the fastest way to lose the founder's trust in everything else here.`,

  "ads-agent": `HOW TO WRITE ADS WORTH TESTING

Three genuinely different angles, not three rewrites of one. If they could be
swapped without changing the argument, you wrote one ad three times.

- Each angle names a different reason to care: a cost, a fear, a rival, a
  moment. Say which angle each one is.
- Lead with the specific claim, not the category. The first four words decide
  whether the rest is read.
- Every claim you can substantiate, and nothing you cannot — platform policy
  refuses superlatives without proof, and a rejected ad costs a week.
- Say what you would measure to know which angle won, before it runs.`,

  "newsletter-agent": `HOW AN EMAIL GETS OPENED AND READ

- The subject tells the truth about what is inside. A subject that oversells
  buys one open and costs the next five.
- One idea per send. A newsletter with four sections is four half-read ones.
- Write to one person. "Hi all" is the sound of nobody being addressed.
- The thing you want them to do is one line, once, and near the end.`,

  "review-agent": `HOW TO REPLY TO A REVIEW

- Name the specific thing they said. A reply that would fit any review is
  read as a form letter, in public, by the next prospect.
- Never argue with a one-star in public. Acknowledge, say what changes, take
  it to email.
- A five-star reply is short and human. Gratitude plus a detail.
- Anything alleging a legal, safety or billing problem is escalated to the
  founder, not answered.`,

  "community-agent": `HOW TO READ A COMMUNITY

- The useful signal is a repeated complaint in the buyer's own words, not a
  trending topic. Quote them; the phrasing is the asset.
- Three posts from three different people is a pattern. One loud post is an
  anecdote, and labelling it a trend is how a roadmap gets hijacked.
- Say where you found it and when. A thread from 2023 is history, not news.
- Never recommend posting into a community the founder has not participated
  in. It reads as spam and it is remembered.`,

  "research-agent": `HOW TO RESEARCH SO THE ANSWER IS USABLE

- Lead with what changed, not with background the founder already has.
- Every claim carries its source and its date.
- Separate observation from inference and label which is which.
- Look where customers talk — support threads, reviews, comparison pages,
  subreddits — not only at the press release.
- Three things that matter beat a digest of twenty.
- The output is not "here is the news", it is "here is what changed and here
  is the move it opens".`,
};

/**
 * The playbook for an agent, or "" when its discipline has none.
 *
 * Returning empty rather than a generic block is deliberate: an agent whose
 * craft has not been distilled yet is better served by its persona alone than
 * by filler that dilutes the specific instructions around it.
 */
export function playbookFor(templateId: string): string {
  return PLAYBOOKS[templateId] ?? "";
}

/** Which disciplines have one. Used by the agent page to show what it knows. */
export function playbookTemplates(): string[] {
  return Object.keys(PLAYBOOKS);
}
