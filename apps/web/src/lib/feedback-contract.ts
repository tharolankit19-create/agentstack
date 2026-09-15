
export const FEEDBACK_CREDITS = 200;
export type FeedbackAnswer = { question: string; answer: string };
export type FeedbackSession = {
 id: string; user_id: string; answers: FeedbackAnswer[]; version: number;
 status: "draft" | "submitted" | "rewarded" | "rejected";
 usage_snapshot: { outputs?: number; agents?: number; latestOutputAt?: string | null; latestOutputKind?: string | null; latestOutputExcerpt?: string | null };
 review_note: string | null; improvement_status: string;
 created_at: string; submitted_at: string | null;
};
export function nextFeedbackQuestion(answers: FeedbackAnswer[], used: boolean, context?: FeedbackSession["usage_snapshot"]): string | null {
 const questions = [
  "What exact job did you come to Kryx to finish? Tell us the product, audience, or outcome so we can judge the answer in context.",
  used
   ? (context?.latestOutputExcerpt ? "Your latest saved " + (context.latestOutputKind || "output") + " starts: “" + context.latestOutputExcerpt + "”. What part of that result was genuinely useful, and what part was wrong, generic, missing, or unusable? If this is not the task you mean, describe the relevant one." : "Take the last task you gave an agent. What did you expect it to hand back, and what did it actually hand back?")
   : "Where were you stopped before getting a useful result? Name the screen, button, setup step, or missing information that blocked you.",
  "What did you have to verify, edit, retry, or do manually after Kryx finished? Give one concrete example. If nothing needed changing, tell us what you used as-is.",
  "Without Kryx, how do you do this job today? Which tool, person, spreadsheet, or manual step would you use instead?",
  "What would stop you from buying another $5 of credits after this session? Be specific about trust, quality, speed, missing data, or price.",
  "If we could change only one thing before your next visit, what should it be and what measurable result would tell you we fixed it? What should we keep as-is, if anything?",
 ];
 return questions[answers.length] ?? null;
}
// Flags are for a human reviewer, never a truth/sentiment score.
export function feedbackFlags(answers: FeedbackAnswer[], outputs: number): string[] {
 const normalized = answers.map(x => x.answer.trim().toLocaleLowerCase().replace(/\s+/g," "));
 const flags: string[] = [];
 if (!outputs) flags.push("No saved outputs; check onboarding blockers rather than assuming abuse.");
 if (new Set(normalized).size < normalized.length) flags.push("Repeated answer: ask for context.");
 if (normalized.slice(0,5).some(x => x.length < 25)) flags.push("Some answers are brief; review context.");
 return flags;
}
