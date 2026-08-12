import bundle from "@/generated/runtime-bundle.json";
import { requireTemplate, type AgentTemplate } from "./templates";
import { encrypt, openSecrets, generateAgentToken, hashToken } from "./crypto";
import { createAdminClient } from "./supabase/admin";
import { toProjectName, type VercelEnvVar } from "./vercel";
import { vercelClientFor } from "./user-hosting";
import { PLATFORM_SECRETS } from "./platform-secrets";
import { platformModelKey, FREE_MODELS, OPENROUTER_BASE } from "./model-config";
import type { Agent, CustomAgentSpec } from "./supabase/types";

/**
 * The deploy pipeline.
 *
 * Take a configured agent row, decrypt its API keys, push the engine to
 * Vercel with those keys as encrypted environment variables, and hand back a
 * URL. The customer never sees a terminal, a repo, or a build log.
 */

interface RuntimeBundle {
  builtAt: string;
  fileCount: number;
  files: { path: string; content: string }[];
}

const RUNTIME = bundle as RuntimeBundle;

export interface DeployOutcome {
  deploymentId: string;
  projectId: string;
  url: string | null;
  readyState: string;
}

export async function deployAgent(agent: Agent): Promise<DeployOutcome> {
  const admin = createAdminClient();
  // Whose Vercel account this lands on depends on the owner's plan: managed
  // tiers use ours, self-hosted tiers use theirs. Resolved per agent rather
  // than per process, because it is a property of the customer.
  const vercel = await vercelClientFor(agent.user_id);

  // A custom agent's "template" is a spec generated from the customer's own
  // SaaS. It is shaped exactly like a catalog template from here down.
  const custom = agent.custom_agent_id ? await loadCustomSpec(agent) : null;
  const template = custom ? templateFromSpec(custom) : requireTemplate(agent.template_id);

  // 1. Decrypt the customer's keys. This is the only moment they exist in
  //    plaintext, and they go straight into Vercel's encrypted env store.
  const { data: secretRow } = await admin
    .from("agent_secrets")
    .select("ciphertext")
    .eq("agent_id", agent.id)
    .maybeSingle<{ ciphertext: string }>();

  const secrets = secretRow?.ciphertext ? openSecrets(secretRow.ciphertext) : {};

  // The platform's key and free models, for admins and for anyone with no key
  // of their own.
  //
  // An admin runs the whole product on the free models — they should not pay
  // per agent to operate it — and a founder who has not pasted a key yet gets
  // the same treatment rather than a "add a key" wall, so the army deploys and
  // runs the moment it is created. A founder who *did* paste their own key
  // keeps it: this only fills a gap, and only an admin overrides.
  const modelOverride = await resolveModel(admin, agent, secrets);

  // Telegram is ours, not theirs.
  //
  // Every template that can message a founder asks for a bot token and a chat
  // id, and making a customer visit @BotFather to get one is three minutes of
  // unrelated work standing between them and a working agent — the single most
  // common place a setup gets abandoned. So the platform runs one bot, its
  // token comes from the environment, and the chat id comes from the link the
  // customer already made by sending a code to that bot.
  //
  // A customer who supplied their own token still gets theirs: this fills gaps,
  // it never overwrites.
  await fillTelegram(admin, agent, template, secrets);

  const missingSpecs = template.secrets.filter(
    (spec) => spec.required && !secrets[spec.key],
  );

  // Telegram missing after the fill above means one specific thing, and saying
  // "add a Telegram bot token" would send the customer to BotFather to solve a
  // problem that is actually one click on their own dashboard.
  if (missingSpecs.some((spec) => PLATFORM_SECRETS.has(spec.key))) {
    throw new Error(
      "Connect Telegram first — open your dashboard, copy the code, and send it to the bot. That is where this agent reports.",
    );
  }

  if (missingSpecs.length > 0) {
    throw new Error(
      `Add these before deploying: ${missingSpecs.map((spec) => spec.label).join(", ")}.`,
    );
  }

  // 2. A fresh bearer token per deploy. The plaintext goes to the deployment;
  //    only its hash is kept here, so a database leak cannot impersonate the
  //    agent on the callback endpoint.
  const agentToken = generateAgentToken();

  const env = buildEnv({ agent, template, secrets, agentToken, custom, model: modelOverride });
  const projectName = toProjectName(`agentstack-${template.id}`, agent.id);

  // 3. Reuse the project across redeploys so the customer's URL never changes.
  //    Variables this pipeline owns are pruned first, so a setting the customer
  //    cleared does not survive in the deployment.
  const managed = isManagedEnvKey(template);

  let projectId = agent.vercel_project_id;
  if (projectId) {
    await vercel.replaceProjectEnv(projectId, env, { prune: managed });
  } else {
    const existing = await vercel.findProject(projectName);
    if (existing) {
      projectId = existing.id;
      await vercel.replaceProjectEnv(projectId, env, { prune: managed });
    } else {
      const created = await vercel.createProject(projectName, env);
      projectId = created.id;
    }
  }

  // 4. Upload the engine, with this agent's cron schedule baked in.
  const files = withSchedule(RUNTIME.files, agent, template.frequency);
  const uploaded = await vercel.uploadFiles(files);

  const deployment = await vercel.createDeployment({
    name: projectName,
    projectId,
    files: uploaded,
  });

  // 5. Persist. The token hash is written last so a failed deploy never leaves
  //    a live token that points at nothing.
  await admin
    .from("agent_secrets")
    .upsert(
      {
        agent_id: agent.id,
        user_id: agent.user_id,
        ciphertext: secretRow?.ciphertext ?? "",
        agent_token_hash: hashToken(agentToken),
        agent_token_enc: encrypt(agentToken),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent_id" },
    );

  await admin
    .from("agents")
    .update({
      status: "deploying",
      vercel_project_id: projectId,
      vercel_deployment_id: deployment.id,
      deploy_url: deployment.url,
      last_error: null,
    })
    .eq("id", agent.id);

  return {
    deploymentId: deployment.id,
    projectId,
    url: deployment.url,
    readyState: deployment.readyState,
  };
}

/**
 * Environment for the deployed agent.
 *
 * Note what is absent: no Supabase URL, no service role key, no other
 * customer's anything. A compromised agent deployment leaks that one agent's
 * own API keys and nothing else.
 */
/**
 * Fills in the Telegram credentials the customer should never have to see.
 *
 * Mutates `secrets` in place, and only where a value is missing. Deliberately
 * silent when there is nothing to fill: an agent whose template does not talk
 * to Telegram, or a customer who has not linked their account yet, both end up
 * exactly where they were — the required-secrets check downstream is what
 * turns a genuinely missing credential into a message, and it says something
 * more useful than this function could.
 */
async function fillTelegram(
  admin: ReturnType<typeof createAdminClient>,
  agent: Agent,
  template: AgentTemplate,
  secrets: Record<string, string>,
): Promise<void> {
  const declares = new Set(template.secrets.map((spec) => spec.key));
  const wantsToken = declares.has("TELEGRAM_BOT_TOKEN") && !secrets.TELEGRAM_BOT_TOKEN;
  const wantsChat = declares.has("TELEGRAM_CHAT_ID") && !secrets.TELEGRAM_CHAT_ID;

  if (!wantsToken && !wantsChat) return;

  const platformToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (wantsToken && platformToken) {
    secrets.TELEGRAM_BOT_TOKEN = platformToken;
  }

  if (!wantsChat) return;

  const { data: link } = await admin
    .from("telegram_links")
    .select("chat_id")
    .eq("user_id", agent.user_id)
    .maybeSingle<{ chat_id: string | null }>();

  if (link?.chat_id) secrets.TELEGRAM_CHAT_ID = link.chat_id;
}

/** What model an agent should run on, and on whose key. */
interface ModelOverride {
  /** The model id to force via AGENT_MODEL, or null to keep the template default. */
  model: string | null;
  /** The base URL the deployed agent should call, or null for the default. */
  baseUrl: string | null;
}

/**
 * Decide the model and key a deploy runs on.
 *
 * Mutates `secrets` to fill in OPENAI_API_KEY when the platform is covering it.
 * Returns the model/base overrides so `buildEnv` can point the deployment at
 * OpenRouter's free tier. Kept here, next to the deploy, because it is the one
 * place that knows both who owns the agent and what keys it holds.
 */
async function resolveModel(
  admin: ReturnType<typeof createAdminClient>,
  agent: Agent,
  secrets: Record<string, string>,
): Promise<ModelOverride> {
  const platform = platformModelKey();
  if (!platform) return { model: null, baseUrl: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", agent.user_id)
    .maybeSingle<{ is_admin: boolean }>();

  const admin_ = Boolean(profile?.is_admin);
  const hasOwnKey = Boolean(secrets.OPENAI_API_KEY);

  // Admin runs everything on the free models. A non-admin with no key of their
  // own gets the free tier too, so the army deploys instead of erroring; a
  // non-admin who pasted their own key keeps it.
  if (admin_ || !hasOwnKey) {
    secrets.OPENAI_API_KEY = platform;
    return { model: FREE_MODELS[0] ?? null, baseUrl: OPENROUTER_BASE };
  }

  return { model: null, baseUrl: null };
}

function buildEnv(input: {
  agent: Agent;
  template: AgentTemplate;
  secrets: Record<string, string>;
  agentToken: string;
  custom: CustomAgentSpec | null;
  model?: ModelOverride;
}): VercelEnvVar[] {
  const { agent, template, secrets, agentToken, custom, model } = input;

  const env: VercelEnvVar[] = [
    { key: "ACTIVE_TEMPLATE", value: template.id },
    { key: "AGENT_ID", value: agent.id },
    { key: "AGENT_TOKEN", value: agentToken },
    { key: "AGENT_PAUSED", value: agent.paused ? "true" : "false" },
    { key: "AGENTSTACK_CALLBACK_URL", value: `${appUrl()}/api/agents/callback` },
  ];

  // A forced model wins over the template default (this is how the free tier is
  // pinned); otherwise the deployed agent falls back to its template's model.
  if (model?.model) {
    env.push({ key: "AGENT_MODEL", value: model.model });
  }

  const baseUrl = model?.baseUrl ?? process.env.OPENAI_BASE_URL;
  if (baseUrl) {
    env.push({ key: "OPENAI_BASE_URL", value: baseUrl });
  }

  // The generated agent travels as one JSON blob. It holds prompts and public
  // endpoint paths — never a credential; the API key rides in SERVICE_API_KEY
  // like every other secret.
  if (custom) {
    env.push({ key: "CUSTOM_AGENT_SPEC", value: JSON.stringify(custom) });
  }

  // Non-secret settings, as SETTING_<UPPER_SNAKE>.
  for (const [key, value] of Object.entries(agent.config ?? {})) {
    if (!value) continue;
    env.push({ key: `SETTING_${toEnvKey(key)}`, value: String(value) });
  }

  // The customer's API keys.
  for (const spec of template.secrets) {
    const value = secrets[spec.key];
    if (value) env.push({ key: spec.key, value });
  }

  return env;
}

/**
 * Writes the agent's own cron schedule into its vercel.json.
 *
 * The customer's coarse "how often" choice wins over the template default,
 * because it is the thing they actually picked in the form.
 */
function withSchedule(
  files: { path: string; content: string }[],
  agent: Agent,
  templateFrequency: string,
): { path: string; content: string }[] {
  // The head agent is the one agent whose schedule the customer sets directly,
  // because the whole promise is that it messages them at times they chose —
  // and it is the only one that runs twice a day.
  const chosen = headAgentCrons(agent.config ?? null);
  const schedules =
    chosen.length > 0
      ? chosen
      : [cronFor(agent.config?.frequency, templateFrequency)];

  return files.map((file) =>
    file.path === "vercel.json"
      ? {
          path: "vercel.json",
          content: `${JSON.stringify(
            {
              $schema: "https://openapi.vercel.sh/vercel.json",
              crons: schedules.map((schedule) => ({
                path: "/api/schedule",
                schedule,
              })),
            },
            null,
            2,
          )}\n`,
        }
      : file,
  );
}

async function loadCustomSpec(agent: Agent): Promise<CustomAgentSpec> {
  const { data } = await createAdminClient()
    .from("custom_agents")
    .select("spec, status")
    .eq("id", agent.custom_agent_id!)
    .maybeSingle<{ spec: CustomAgentSpec | null; status: string }>();

  if (!data?.spec || data.status !== "ready") {
    throw new Error(
      "This agent's build is not finished. Rebuild it from the dashboard before deploying.",
    );
  }
  return data.spec;
}

/** Presents a generated spec with the same shape as a catalog template. */
function templateFromSpec(spec: CustomAgentSpec): AgentTemplate {
  const needsKey = Boolean(spec.api?.baseUrl);

  return {
    id: "custom-agent",
    name: spec.name,
    description: spec.description,
    category: "Custom",
    icon: "🧩",
    replaces: spec.replaces,
    frequency: "0 9 * * 1-5",
    model: "gpt-4o-mini",
    temperature: 0.6,
    maxIterations: 10,
    tools: [],
    prompts: ["system"],
    scheduledTask: spec.scheduledTask,
    examples: spec.examples,
    settings: [],
    secrets: [
      { key: "OPENAI_API_KEY", label: "OpenAI API key", required: true },
      ...(needsKey
        ? [{ key: "SERVICE_API_KEY", label: `${spec.name} API key`, required: true }]
        : []),
    ],
  };
}

/**
 * Which environment variables the deploy pipeline owns.
 *
 * Anything matching this is safe to delete on a redeploy, because this code
 * puts it back. Anything else — a variable the founder added to the project by
 * hand — is left alone.
 */
function isManagedEnvKey(
  template: ReturnType<typeof requireTemplate>,
): (key: string) => boolean {
  const secretKeys = new Set(template.secrets.map((spec) => spec.key));
  const platformKeys = new Set([
    "ACTIVE_TEMPLATE",
    "AGENT_ID",
    "AGENT_TOKEN",
    "AGENT_PAUSED",
    "AGENTSTACK_CALLBACK_URL",
    "OPENAI_BASE_URL",
  ]);

  return (key) =>
    key.startsWith("SETTING_") || secretKeys.has(key) || platformKeys.has(key);
}

/**
 * UTC offsets for the timezones the head agent offers.
 *
 * A fixed table rather than a library because Vercel cron is UTC-only and the
 * set of choices is ten entries long. The cost of that simplicity is honest
 * and worth naming: these are standard-time offsets, so a founder in a
 * DST-observing zone gets their briefing an hour early for part of the year.
 * That is a known, acceptable drift for a 9am message — and it is why the
 * settings label says "your local time" rather than promising to the minute.
 */
const TZ_OFFSETS: Record<string, number> = {
  UTC: 0,
  "Asia/Kolkata": 5.5,
  "Asia/Dubai": 4,
  "Asia/Singapore": 8,
  "Europe/London": 0,
  "Europe/Berlin": 1,
  "America/New_York": -5,
  "America/Chicago": -6,
  "America/Los_Angeles": -8,
  "Australia/Sydney": 11,
};

/**
 * The founder's chosen hour, in their zone, as a UTC cron expression.
 *
 * This is what makes "it messages you at 9am" true rather than decorative:
 * the head agent's schedule is derived from what they picked, not from a
 * template default that ignores where they live.
 */
export function dailyCronAt(
  localTime: string | undefined,
  timezone: string | undefined,
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((localTime ?? "").trim());
  if (!match) return null;

  const offset = TZ_OFFSETS[(timezone ?? "").trim()];
  if (offset === undefined) return null;

  const localMinutes = Number(match[1]) * 60 + Number(match[2]);
  // Subtract the offset to get UTC, then wrap into a single day. The modulo is
  // doubled up because JavaScript's % keeps the sign of the dividend, and a
  // negative minute-of-day produces a cron expression Vercel rejects.
  const utcMinutes = (((localMinutes - offset * 60) % 1440) + 1440) % 1440;

  return `${utcMinutes % 60} ${Math.floor(utcMinutes / 60)} * * *`;
}

/**
 * Every time the head agent should report, as UTC cron expressions.
 *
 * Two messages a day, and they are genuinely different: the morning is a plan
 * and the evening is a receipt. The evening one is optional — a founder who
 * only wants the morning sets it to "Off" and gets one entry back.
 *
 * Deduplicated, because picking the same hour for both would otherwise
 * register two identical crons and deliver the briefing twice.
 */
export function headAgentCrons(config: Record<string, unknown> | null): string[] {
  const morning = dailyCronAt(
    config?.morningTime as string | undefined,
    config?.timezone as string | undefined,
  );
  const evening = dailyCronAt(
    config?.eveningTime as string | undefined,
    config?.timezone as string | undefined,
  );

  return [...new Set([morning, evening].filter((cron): cron is string => Boolean(cron)))];
}

export function cronFor(choice: string | undefined, fallback: string): string {
  switch ((choice ?? "").trim()) {
    case "Every weekday 9am":
      return "0 9 * * 1-5";
    case "Every day 9am":
      return "0 9 * * *";
    case "Mondays only":
      return "0 9 * * 1";
    // Vercel needs a valid expression even when the agent will refuse the tick,
    // so a manual agent still gets a schedule — the runtime declines to act.
    case "Manual only":
      return "0 9 * * 1";
    default:
      return fallback;
  }
}

function toEnvKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * Turns whatever someone typed into an environment variable into a URL, or
 * gives up on it quietly.
 *
 * Returns undefined rather than throwing, and that is the entire point. This
 * value is read at module scope by the root layout (`new URL(appUrl())` for
 * metadataBase), so a throw here is not a bad page — it is a failed build, on
 * every route at once, with a stack trace that names `/_not-found` and never
 * mentions the environment variable that caused it. A hostname pasted without
 * `https://` is a completely ordinary thing to do and must not be able to do
 * that.
 */
function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  // A bare hostname is the common case: "as.saasgrave.org" rather than
  // "https://as.saasgrave.org". Assume https, which is the only thing anyone
  // means in production.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    // Reject anything without a real host, so "https://" alone or a stray
    // "localhost" typo does not become a metadataBase that silently breaks
    // every canonical and Open Graph URL on the site.
    if (!url.hostname || !url.hostname.includes(".")) {
      if (url.hostname !== "localhost") return undefined;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return undefined;
  }
}

/**
 * The site's own origin.
 *
 * Order matters: an explicit setting wins, then Vercel's production domain
 * (stable across deploys, so canonicals and OG URLs do not point at a preview),
 * then the per-deployment URL, then localhost.
 */
export function appUrl(): string {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeUrl(process.env.VERCEL_URL) ??
    "http://localhost:3000"
  );
}

export function runtimeBundleInfo() {
  return { builtAt: RUNTIME.builtAt, fileCount: RUNTIME.fileCount };
}
