import "server-only";
import { createAdminClient } from "./supabase/admin";
import { openSecrets, sealSecrets, maskSecret } from "./crypto";

/**
 * The founder's connectors — their own keys to the outside world, in one place.
 *
 * Each connector is one key the founder pastes once and every part of the army
 * that needs it reads from here: the research cron uses Firecrawl and X, and the
 * deploy pipeline hands Apollo and Resend to the agents whose templates declare
 * them. The whole point is low friction — one page, one paste per tool, and it
 * is wired everywhere at once instead of per agent.
 *
 * Keys live in a single AES-256-GCM envelope per founder (the `user_connectors`
 * table), opened only on the server. The browser is never given a key back —
 * only whether one is on file and a masked hint of it.
 */

export type ConnectorId = "model" | "monid" | "firecrawl" | "x" | "apollo" | "resend";

export interface ConnectorMeta {
  id: ConnectorId;
  name: string;
  /** The environment/secret name this maps to, so consumers agree on it. */
  envKey: string;
  /** One line the founder reads to decide whether to bother. */
  blurb: string;
  /** What breaks or improves once it is connected. */
  unlocks: string;
  placeholder: string;
  /** Where to get the key, for the founder who does not have one yet. */
  getUrl: string;
}

/**
 * The connectors the army knows how to use.
 *
 * Order is deliberate: Firecrawl and X are the two that make the research pulse
 * actually look at the world, so they come first; Apollo and Resend are the
 * outreach squad's hands, wired in at deploy time.
 */
export const CONNECTORS: ConnectorMeta[] = [
  {
    id: "model",
    name: "Model key (OpenRouter)",
    envKey: "OPENAI_API_KEY",
    blurb: "The brain every agent thinks with. Without one, nothing can run.",
    unlocks:
      "Powers every agent — chat, research, drafts, briefings. OpenRouter's free models cost nothing, so one key runs the whole army.",
    placeholder: "sk-or-v1-…",
    getUrl: "https://openrouter.ai/keys",
  },
  {
    id: "monid",
    name: "Monid",
    envKey: "MONID_API_KEY",
    blurb: "One key that gives every squad hundreds of data tools.",
    unlocks:
      "Leads, company data, social listening, reviews — the squads pick the right tool per job instead of needing a separate account for each. One balance, and every run reports what it cost.",
    placeholder: "monid_live_…",
    getUrl: "https://app.monid.ai/access/api-keys",
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    envKey: "FIRECRAWL_API_KEY",
    blurb: "Lets your research squad read live web pages, not just guess.",
    unlocks:
      "Competitor pages, this week's news, anything that changed overnight — the research agent reads it and pings you when it matters.",
    placeholder: "fc-…",
    getUrl: "https://www.firecrawl.dev/app/api-keys",
  },
  {
    id: "x",
    name: "X (Twitter)",
    envKey: "XQUIK_API_KEY",
    blurb: "Watch X for signal, and post your approved drafts to it.",
    unlocks:
      "The research agent reads what people are saying, and you can approve a draft to post straight to X — never without your say-so.",
    placeholder: "xq-…",
    getUrl: "https://xquik.com/dashboard",
  },
  {
    id: "apollo",
    name: "Apollo",
    envKey: "APOLLO_API_KEY",
    blurb: "Turns a plain-English customer into a real list of people.",
    unlocks:
      "Your outreach squad finds actual leads that match your ICP instead of inventing them. Wired into those agents when they deploy.",
    placeholder: "…",
    getUrl: "https://developer.apollo.io/keys",
  },
  {
    id: "resend",
    name: "Resend",
    envKey: "RESEND_API_KEY",
    blurb: "So the outreach and inbox agents can actually send email.",
    unlocks:
      "Approved emails go out through your own Resend account. Wired into those agents when they deploy.",
    placeholder: "re_…",
    getUrl: "https://resend.com/api-keys",
  },
];

const BY_ID = new Map(CONNECTORS.map((c) => [c.id, c]));
/** The secret/env name a connector maps to (FIRECRAWL_API_KEY, …). */
export function envKeyFor(id: ConnectorId): string | undefined {
  return BY_ID.get(id)?.envKey;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Every connector key the founder has on file, id -> value. Server-only. */
export async function loadConnectors(
  admin: Admin,
  userId: string,
): Promise<Partial<Record<ConnectorId, string>>> {
  const { data } = await admin
    .from("user_connectors")
    .select("ciphertext")
    .eq("user_id", userId)
    .maybeSingle<{ ciphertext: string }>();

  if (!data?.ciphertext) return {};
  try {
    return openSecrets(data.ciphertext) as Partial<Record<ConnectorId, string>>;
  } catch {
    return {};
  }
}

/**
 * The founder's key for a given secret name, or null.
 *
 * The bridge between "the founder connected Firecrawl" and the code that reads
 * `FIRECRAWL_API_KEY`: consumers pass the env name and get the founder's value
 * if they connected it, falling back to whatever the caller decides.
 */
export async function connectorKeyByEnv(
  admin: Admin,
  userId: string,
  envKey: string,
): Promise<string | null> {
  const stored = await loadConnectors(admin, userId);
  for (const meta of CONNECTORS) {
    if (meta.envKey === envKey && stored[meta.id]) return stored[meta.id]!;
  }
  return null;
}

/** Save (or replace) one connector's key, merged into the founder's envelope. */
export async function saveConnector(
  admin: Admin,
  userId: string,
  id: ConnectorId,
  value: string,
): Promise<void> {
  const existing = await loadConnectors(admin, userId);
  const next = { ...existing, [id]: value.trim() };
  await writeEnvelope(admin, userId, next);
}

/** Forget one connector's key. */
export async function removeConnector(
  admin: Admin,
  userId: string,
  id: ConnectorId,
): Promise<void> {
  const existing = await loadConnectors(admin, userId);
  delete existing[id];
  await writeEnvelope(admin, userId, existing);
}

async function writeEnvelope(
  admin: Admin,
  userId: string,
  map: Partial<Record<ConnectorId, string>>,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(map).filter(([, v]) => typeof v === "string" && v.trim()),
  ) as Record<string, string>;

  await admin.from("user_connectors").upsert(
    {
      user_id: userId,
      ciphertext: sealSecrets(clean),
      keys: Object.keys(clean),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/**
 * The house key for a connector — what everyone falls back to.
 *
 * "Use my Firecrawl for now" has an obvious literal meaning: the owner's own
 * key should power research for every founder until each connects their own. So
 * the platform key is, in order: an explicit environment variable, then the
 * key the owner (an admin) connected on their own Connectors page. That second
 * path is the one that needs no Vercel access and no key pasted into a chat —
 * the owner connects it once, like any founder, and it quietly becomes the
 * default for all of them.
 *
 * Cached briefly so a cron sweeping every founder does not re-read the owner's
 * envelope once per founder.
 */
const houseCache = new Map<string, { value: string | null; at: number }>();
const HOUSE_TTL_MS = 60_000;

export async function houseKey(
  admin: Admin,
  id: ConnectorId,
  envKey: string,
): Promise<string | null> {
  const env = process.env[envKey]?.trim();
  if (env) return env;

  const cached = houseCache.get(id);
  if (cached && Date.now() - cached.at < HOUSE_TTL_MS) return cached.value;

  let value: string | null = null;
  const { data: owner } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (owner?.id) {
    const owned = await loadConnectors(admin, owner.id);
    value = owned[id] ?? null;
  }

  houseCache.set(id, { value, at: Date.now() });
  return value;
}

/** The Firecrawl key research should use for a founder without their own. */
export function houseFirecrawlKey(admin: Admin): Promise<string | null> {
  return houseKey(admin, "firecrawl", "FIRECRAWL_API_KEY");
}

/** The X (Xquik) key for a founder without their own. */
export function houseXKey(admin: Admin): Promise<string | null> {
  return houseKey(admin, "x", "XQUIK_API_KEY");
}

/**
 * The Monid key a squad reaches the outside world with.
 *
 * Resolves the same way every other shared key does — the platform's own
 * environment variable first, then the key the owner connected in-product — so
 * a founder who has connected nothing still gets working agents, and one who
 * brings their own key spends their own balance rather than the platform's.
 */
export function houseMonidKey(admin: Admin): Promise<string | null> {
  return houseKey(admin, "monid", "MONID_API_KEY");
}

/**
 * The model key the whole platform runs on.
 *
 * This is the one that decides whether the product works at all: with no model
 * key, every agent fails to deploy ("add an OpenAI API key"), chat falls back to
 * nothing, and the crons produce silence. Requiring it as a Vercel environment
 * variable made that a hidden single point of failure — the platform looked
 * configured while every agent quietly refused to run.
 *
 * So it resolves the same way Firecrawl does: an explicit env var if one is set,
 * otherwise the key the owner connected on their own Connectors page. Connect it
 * once, in the product, and every founder's army runs on it.
 */
export async function houseModelKey(admin: Admin): Promise<string | null> {
  const env =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.PLATFORM_OPENROUTER_KEY?.trim() ||
    process.env.PLATFORM_MODEL_KEY?.trim() ||
    process.env.DEMO_OPENAI_API_KEY?.trim();
  if (env) return env;

  return houseKey(admin, "model", "__none__");
}

export interface ConnectorState {
  id: ConnectorId;
  name: string;
  blurb: string;
  unlocks: string;
  placeholder: string;
  getUrl: string;
  connected: boolean;
  /** A hint like `fc-…a91f` so the founder recognises which key is saved. */
  hint: string | null;
}

/**
 * What the connectors page renders.
 *
 * Never returns a raw key — only whether one is present and a masked hint, so a
 * key cannot be read off the screen.
 */
export async function connectorStates(
  admin: Admin,
  userId: string,
): Promise<ConnectorState[]> {
  const stored = await loadConnectors(admin, userId);
  return CONNECTORS.map((meta) => {
    const value = stored[meta.id];
    return {
      id: meta.id,
      name: meta.name,
      blurb: meta.blurb,
      unlocks: meta.unlocks,
      placeholder: meta.placeholder,
      getUrl: meta.getUrl,
      connected: Boolean(value),
      hint: value ? maskSecret(value) : null,
    };
  });
}
