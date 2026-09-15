
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
  "Think about your last visit. What were you trying to get done, and for what business or project?",
  used
   ? (context?.latestOutputExcerpt ? "Your latest saved " + (context.latestOutputKind || "output") + " starts: “" + context.latestOutputExcerpt + "”. What were you trying to achieve with that task, and what actually happened? If this is not the task you mean, describe the relevant one." : "Walk me through the last task you gave an agent. What did you expect, and what actually happened? A concrete example helps.")
   : "How far did you get? Tell me the screen or step where you stopped and what you expected to happen. Not getting started is useful feedback too.",
  "What did you have to edit, retry, or do yourself? If nothing needed changing, tell me which part you used as-is.",
  "How would you do this job without Kryx today? What takes the most time or money?",
  "If we changed one thing before your next visit, what should it be, and what would that let you do?",
  "What should we keep as it is, if anything? Is there anything else we have misunderstood about how you work?",
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
