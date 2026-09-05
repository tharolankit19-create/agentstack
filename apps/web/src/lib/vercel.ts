import { createHash } from "node:crypto";

/**
 * Vercel REST API client — the part of AgentStack that turns a filled-in form
 * into a running agent on a URL.
 *
 * Deployments are created by uploading the engine's source files directly.
 * The alternative — creating a GitHub repo per customer and deploying from git
 * — adds a second provider, a second set of tokens, and a second thing that
 * can be rate-limited, in exchange for nothing the customer can see.
 */

const API = "https://api.vercel.com";

export interface VercelEnvVar {
  key: string;
  value: string;
  target?: ("production" | "preview" | "development")[];
}

export interface VercelFile {
  path: string;
  content: string;
}

export interface UploadedFile {
  file: string;
  sha: string;
  size: number;
}

export interface DeploymentState {
  id: string;
  url: string | null;
  readyState: string;
  /** Vercel's own error, when the build failed. */
  errorMessage?: string | null;
}

export class VercelError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "VercelError";
  }
}

interface ClientOptions {
  token?: string;
  teamId?: string;
}

export class VercelClient {
  private readonly token: string;
  private readonly teamId?: string;

  constructor(options: ClientOptions = {}) {
    const token = options.token ?? process.env.VERCEL_API_TOKEN;
    if (!token) {
      throw new Error(
        "VERCEL_API_TOKEN is not set. Create one at vercel.com/account/tokens.",
      );
    }
    this.token = token;
    this.teamId = options.teamId ?? process.env.VERCEL_TEAM_ID ?? undefined;
  }

  private url(path: string, params: Record<string, string> = {}): string {
    const url = new URL(path, API);
    if (this.teamId) url.searchParams.set("teamId", this.teamId);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    init: RequestInit & { params?: Record<string, string> } = {},
  ): Promise<T> {
    const { params, ...rest } = init;
    const response = await fetch(this.url(path, params), {
      ...rest,
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        ...(rest.headers ?? {}),
      },
      signal: rest.signal ?? AbortSignal.timeout(60_000),
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* fall through to the raw text below */
    }

    if (!response.ok) {
      const error =
        body && typeof body === "object"
          ? ((body as Record<string, unknown>).error as
              | { message?: string; code?: string }
              | undefined)
          : undefined;
      throw new VercelError(
        error?.message ?? text.slice(0, 300) ?? "Vercel request failed",
        response.status,
        error?.code,
      );
    }

    return body as T;
  }

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  async createProject(
    name: string,
    envVars: VercelEnvVar[],
  ): Promise<{ id: string; name: string }> {
    return this.request<{ id: string; name: string }>("/v11/projects", {
      method: "POST",
      body: JSON.stringify({
        name,
        framework: "nextjs",
        environmentVariables: envVars.map((env) => ({
          key: env.key,
          value: env.value,
          target: env.target ?? ["production", "preview", "development"],
          type: "encrypted",
        })),
      }),
    });
  }

  /**
   * How many projects this account already holds.
   *
   * Needed because the product creates one Vercel project per agent, and an
   * account has a hard ceiling on them. Without this, deploying a founder's
   * army succeeds for the first several and then starts failing partway with
   * whatever Vercel says about limits — leaving that founder with a half-built
   * army and no explanation. Checking first turns that into one clear refusal
   * before anything is spent.
   *
   * Counted rather than listed: the caller only needs the number, and paging
   * the whole list to length it would be several requests for one integer.
   */
  async countProjects(): Promise<number> {
    let total = 0;
    let next: number | undefined;

    // Vercel pages this endpoint and there is no count-only variant, so this
    // walks it — bounded at ten pages so a very large account cannot turn a
    // pre-flight check into a minute of requests.
    for (let page = 0; page < 10; page += 1) {
      const data = await this.request<{
        projects: { id: string }[];
        pagination?: { next?: number | null };
      }>("/v9/projects", {
        params: { limit: "100", ...(next ? { until: String(next) } : {}) },
      });

      total += data.projects?.length ?? 0;
      const cursor = data.pagination?.next;
      if (!cursor) return total;
      next = cursor;
    }

    return total;
  }

  async findProject(name: string): Promise<{ id: string; name: string } | null> {
    try {
      return await this.request<{ id: string; name: string }>(
        `/v9/projects/${encodeURIComponent(name)}`,
      );
    } catch (cause) {
      if (cause instanceof VercelError && cause.status === 404) return null;
      throw cause;
    }
  }

  /**
   * Rewrites the project's environment. Existing keys are replaced rather than
   * duplicated, so rotating a customer's API key does not leave the old one
   * behind for the next build to pick up.
   *
   * `prune` widens that to keys the caller no longer sends at all. A redeploy
   * passes a predicate matching the variables it owns, so a setting the
   * customer cleared — or a key they removed — actually disappears instead of
   * living on in the deployment forever.
   */
  async replaceProjectEnv(
    projectId: string,
    envVars: VercelEnvVar[],
    options: { prune?: (key: string) => boolean } = {},
  ): Promise<void> {
    const existing = await this.request<{
      envs: { id: string; key: string }[];
    }>(`/v10/projects/${projectId}/env`, { params: { decrypt: "false" } });

    const incoming = new Set(envVars.map((env) => env.key));
    for (const env of existing.envs ?? []) {
      const replaced = incoming.has(env.key);
      const stale = options.prune?.(env.key) ?? false;
      if (!replaced && !stale) continue;
      await this.request(`/v9/projects/${projectId}/env/${env.id}`, {
        method: "DELETE",
      });
    }

    if (envVars.length === 0) return;

    await this.request(`/v10/projects/${projectId}/env`, {
      method: "POST",
      body: JSON.stringify(
        envVars.map((env) => ({
          key: env.key,
          value: env.value,
          target: env.target ?? ["production", "preview", "development"],
          type: "encrypted",
        })),
      ),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/v9/projects/${projectId}`, { method: "DELETE" });
  }

  // -------------------------------------------------------------------------
  // Files + deployments
  // -------------------------------------------------------------------------

  /**
   * Uploads the engine's files. Vercel dedupes by SHA-1, so re-deploying an
   * unchanged engine costs almost nothing on the second customer onward.
   */
  async uploadFiles(files: VercelFile[]): Promise<UploadedFile[]> {
    const uploaded: UploadedFile[] = [];

    // Six at a time: enough to be fast, gentle enough not to get rate limited
    // when several customers deploy at once.
    const queue = [...files];
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      for (;;) {
        const file = queue.shift();
        if (!file) return;
        uploaded.push(await this.uploadFile(file));
      }
    });
    await Promise.all(workers);

    return uploaded;
  }

  private async uploadFile(file: VercelFile): Promise<UploadedFile> {
    const body = Buffer.from(file.content, "utf8");
    const sha = createHash("sha1").update(body).digest("hex");

    const response = await fetch(this.url("/v2/files"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/octet-stream",
        "x-vercel-digest": sha,
        "content-length": String(body.length),
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new VercelError(
        `Uploading ${file.path} failed: ${detail.slice(0, 200)}`,
        response.status,
      );
    }

    return { file: file.path, sha, size: body.length };
  }

  async createDeployment(options: {
    name: string;
    projectId: string;
    files: UploadedFile[];
    env?: VercelEnvVar[];
  }): Promise<DeploymentState> {
    const deployment = await this.request<{
      id: string;
      url?: string;
      readyState?: string;
      status?: string;
    }>("/v13/deployments", {
      method: "POST",
      params: { forceNew: "1", skipAutoDetectionConfirmation: "1" },
      body: JSON.stringify({
        name: options.name,
        project: options.projectId,
        target: "production",
        files: options.files,
        projectSettings: {
          framework: "nextjs",
          installCommand: "npm install --no-audit --no-fund",
          buildCommand: null,
          outputDirectory: null,
          rootDirectory: null,
          nodeVersion: "22.x",
        },
      }),
    });

    return {
      id: deployment.id,
      url: deployment.url ? `https://${deployment.url}` : null,
      readyState: deployment.readyState ?? deployment.status ?? "QUEUED",
    };
  }

  async getDeployment(deploymentId: string): Promise<DeploymentState> {
    const deployment = await this.request<{
      id: string;
      url?: string;
      readyState?: string;
      status?: string;
      errorMessage?: string | null;
    }>(`/v13/deployments/${deploymentId}`);

    return {
      id: deployment.id,
      url: deployment.url ? `https://${deployment.url}` : null,
      readyState: deployment.readyState ?? deployment.status ?? "QUEUED",
      errorMessage: deployment.errorMessage ?? null,
    };
  }
}

/** Vercel project names: lowercase, alphanumeric and dashes, 100 chars max. */
export function toProjectName(prefix: string, agentId: string): string {
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = agentId.replace(/-/g, "").slice(0, 12);
  return `${slug || "agent"}-${suffix}`;
}

export function isTerminal(readyState: string): boolean {
  return ["READY", "ERROR", "CANCELED", "DELETED"].includes(
    readyState.toUpperCase(),
  );
}
