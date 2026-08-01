/** Hand-written mirror of supabase/migrations/0001_init.sql. */

export type PlanTier = "none" | "starter" | "pro";

export type AgentStatus =
  | "draft"
  | "configured"
  | "deploying"
  | "deployed"
  | "error";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: PlanTier;
  agent_quota: number;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  template_id: string;
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
  created_at: string;
}

export interface ChatMessage {
  id: string;
  agent_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AgentStats {
  agent_id: string;
  user_id: string;
  generations_this_month: number;
  runs_this_month: number;
  last_run_at: string | null;
}
