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

export type ConnectorId = "firecrawl" | "x" | "apollo" | "resend";

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
