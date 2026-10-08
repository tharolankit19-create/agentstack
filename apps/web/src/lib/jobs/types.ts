export const TASK_CLASSES = ["LEAD_LIST", "RESEARCH_BRIEF", "COMPETITOR_SCAN", "OUTREACH_DRAFTS", "CONTENT_REPURPOSE"] as const;
export type TaskClass = typeof TASK_CLASSES[number];
export const JOB_STATES = ["created", "planning", "ready", "queued", "running", "waiting_for_browser", "waiting_for_device", "waiting_for_user", "recovering", "verifying", "completed", "failed", "refunded", "cancelled"] as const;
export type JobState = typeof JOB_STATES[number];
export type JobView = "working" | "needs_you" | "finished" | "scheduled";
export interface Predicate { id: string; kind: string; field?: string; value?: number | string; }
export interface CompletionContract {
  version: string;
  taskClass: TaskClass;
  inputs: { goal: string; count: number; icp: string; outreach: boolean; voice: string; urls: string[]; workspace?: Record<string, string>; };
  predicates: Predicate[];
}
export interface Check { id: string; passed: boolean; detail: string; }
export interface VerificationResult { passed: boolean; checks: Check[]; failedPredicates: string[]; outputHash: string; contractVersion: string; verifiedAt: string; verifierRunId: string; }
export interface Receipt {
  result: string; rows: number; sourcesChecked: number; duplicates: number;
  checksPassed: number; checksTotal: number; creditsUsed: number; releasedCredits: number;
  failedAttemptsCharged: number; elapsedSeconds: number;
}
export interface Job {
  id: string; user_id: string; instruction: string; task_class: TaskClass; status: JobState;
  completion_contract: CompletionContract; estimated_credits: number; estimate_min: number;
  hard_cap: number; credits_used: number; reserved_credits: number; is_free: boolean;
  created_at: string; started_at: string | null; finished_at: string | null;
  summary: string | null; receipt: Receipt | null; next_run_at: string | null;
  lease_token: string | null; lease_expires_at: string | null; attempt: number; max_attempts: number;
}
export interface JobMessage { id: string; role: "user" | "assistant"; content: string; created_at: string; }
export interface JobEvent { id: string; event_type: string; label: string; created_at: string; }
export interface JobArtifact { id: string; name: string; media_type: string; sha256: string; }
export interface JobDetail { job: Job; messages: JobMessage[]; events: JobEvent[]; artifacts: JobArtifact[]; verification: VerificationResult | null; browser: { id: string; status: string; } | null; }
export const STATE_LABELS: Record<JobState, string> = {
  created: "Review completion criteria", planning: "Planning the job", ready: "Ready to start", queued: "Queued",
  running: "Working", waiting_for_browser: "Waiting for browser", waiting_for_device: "Waiting for device",
  waiting_for_user: "Needs you", recovering: "Recovering", verifying: "Checking the result",
  completed: "Verified and finished", failed: "Could not finish", refunded: "Failed · reservation released", cancelled: "Cancelled",
};
