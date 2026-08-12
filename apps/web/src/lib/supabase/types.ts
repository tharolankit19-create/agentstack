/** Hand-written mirror of supabase/migrations/*.sql. */

export type PlanTier = "none" | "starter" | "pro" | "unlimited";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type AgentStatus =
  | "draft"
  | "configured"
  | "deploying"
  | "deployed"
  | "error";

export type CustomAgentStatus = "analyzing" | "ready" | "failed";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: PlanTier;
  agent_quota: number;
  subscribed_at: string | null;
  onboarded_at: string | null;
  company: string | null;
  problems: string[];
  monthly_spend: number | null;
  current_tools: string[];
  subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** Full access without a subscription. Set in the database, never by the app. */
  is_admin: boolean;
  /** Credits this plan grants per period, and how many are spent. A unit, not a currency. */
  credits_included: number;
  credits_used: number;
  credits_reset_at: string | null;
  /** Set once, never cleared — its presence makes the trial one-per-account. */
  trial_started_at: string | null;
  /** When instant access expires. Ignored once a subscription is active. */
  trial_ends_at: string | null;
  /**
   * The customer's own Vercel account, for the plans where their agents run on
   * their infrastructure. The token itself is never selected into the app
   * outside the deploy path — these three are what the UI shows instead.
   */
  vercel_account_label: string | null;
  vercel_team_id: string | null;
  vercel_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  template_id: string;
  custom_agent_id: string | null;
  name: string;
  status: AgentStatus;
  config: Record<string, string>;
  secret_keys: string[];
  paused: boolean;
  deploy_url: string | null;
  vercel_project_id: string | null;
  vercel_deployment_id: string | null;
  last_error: string | null;
  last_run_at: string | null;
  deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomAgent {
  id: string;
  user_id: string;
  source_url: string;
  source_name: string | null;
  status: CustomAgentStatus;
  spec: CustomAgentSpec | null;
  sources: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors CustomAgentSpec in apps/hermes-core/src/core/types.ts. */
export interface CustomAgentSpec {
  id: string;
  name: string;
  description: string;
  replaces: { tools: string[]; monthlyUsd: number };
  systemPrompt: string;
  scheduledTask: string;
  examples: string[];
  api?: {
    baseUrl: string;
    auth: "bearer" | "header" | "query" | "none";
    authName?: string;
    endpoints: { method: string; path: string; purpose: string }[];
  };
  sources: string[];
}

export interface AgentRun {
  id: string;
  agent_id: string;
  user_id: string;
  external_run_id: string | null;
  trigger: string;
  status: string;
  output: string | null;
  error: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  iterations: number | null;
  tool_calls: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface Generation {
  id: string;
  agent_id: string;
  user_id: string;
  run_id: string | null;
  kind: string;
  content: string;
  meta: Record<string, unknown> | null;
  /** False until the founder approves it. Nothing publishes or sends without it. */
  approved: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface TelegramLink {
  user_id: string;
  chat_id: string | null;
  link_code: string | null;
  code_expires_at: string | null;
  linked_at: string | null;
  created_at: string;
}

export interface ScheduledTask {
  id: string;
  user_id: string;
  agent_id: string | null;
  instruction: string;
  run_at: string;
  when_label: string | null;
  status: "pending" | "done" | "failed" | "cancelled";
  result: string | null;
  error: string | null;
  created_at: string;
  ran_at: string | null;
}

export interface ChatMessage {
  id: string;
  agent_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SupportMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type NoteKind =
  | "worked"
  | "failed"
  | "audience"
  | "competitor"
  | "style"
  | "fact";

/** What one agent learned, for one customer. Private, never shared. */
export interface AgentNote {
  id: string;
  user_id: string;
  agent_id: string;
  template_id: string;
  kind: NoteKind;
  key: string;
  summary: string;
  observations: number;
  score: number;
  last_seen_at: string;
  created_at: string;
}

/** A lesson enough different customers reached that it stopped being private. */
export interface PlaybookEntry {
  id: string;
  template_id: string;
  kind: NoteKind;
  key: string;
  lesson: string;
  users_seen: number;
  observations: number;
  score: number;
  updated_at: string;
  created_at: string;
}

/** A rewrite an agent proposed for one of its own prompts. */
export interface PromptRevision {
  id: string;
  user_id: string;
  agent_id: string;
  prompt_name: string;
  body: string;
  reason: string | null;
  version: number;
  active: boolean;
  created_at: string;
}

export interface AgentStats {
  agent_id: string;
  user_id: string;
  generations_this_month: number;
  runs_this_month: number;
  last_run_at: string | null;
}
