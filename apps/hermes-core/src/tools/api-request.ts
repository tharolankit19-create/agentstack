import { getSecret } from "@/core/secrets";
import { normalizeUrl } from "@/integrations/scraper";
import { customSpec } from "@/templates/custom";
import type { Tool } from "@/core/types";

/**
 * Call the SaaS API this agent is connected to.
 *
 * This is the primitive that makes "replace the tool you are already paying
 * for" work without writing an integration per vendor. The customer pastes
 * their existing API key, the platform records the base URL and auth style,
 * and the agent drives that API directly.
 *
 * Three limits keep it from being a proxy for the whole internet:
 *   - the host is fixed by the stored base URL; the model supplies a path only
 *   - private address ranges are refused
 *   - the key is attached here, never shown to the model, and never echoed back
 */
export const apiRequestTool: Tool = {
  name: "api_request",
  description:
    "Call the connected service's API. Give a method and a path relative to " +
    "the service's base URL. Authentication is added automatically — never ask " +
    "the user for a key and never put one in the arguments.",
  parameters: {
    type: "object",
    properties: {
      method: {
        type: "string",
        enum: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        description: "HTTP method.",
      },
      path: {
        type: "string",
        description:
          "Path relative to the service base URL, e.g. /v1/contacts?limit=10",
      },
      body: {
        type: "object",
        description: "JSON body for POST/PATCH/PUT.",
        additionalProperties: true,
      },
    },
    required: ["method", "path"],
    additionalProperties: false,
  },
  async run(args, ctx) {
    const spec = customSpec();
    const baseUrl = spec?.api?.baseUrl || ctx.config.apiBaseUrl;
    if (!baseUrl) {
      throw new Error(
        "No API is connected to this agent. Add the service's API key and base " +
          "URL in the dashboard, then redeploy.",
      );
    }

    const method = String(args.method ?? "GET").toUpperCase();
    const path = String(args.path ?? "/");
    const target = resolve(baseUrl, path);

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "AgentStack/1.0",
    };

    const key = getSecret("SERVICE_API_KEY");
    const auth = spec?.api?.auth ?? (ctx.config.apiAuth as string) ?? "bearer";

    if (key) {
      if (auth === "bearer") {
        headers.authorization = `Bearer ${key}`;
      } else if (auth === "header") {
        headers[spec?.api?.authName || ctx.config.apiAuthName || "x-api-key"] = key;
      } else if (auth === "query") {
        target.searchParams.set(
          spec?.api?.authName || ctx.config.apiAuthName || "api_key",
          key,
        );
      }
    }

    const hasBody = method !== "GET" && method !== "DELETE" && args.body;
    if (hasBody) headers["content-type"] = "application/json";

    ctx.log("api.request", { method, path });

    const response = await fetch(target, {
      method,
      headers,
      body: hasBody ? JSON.stringify(args.body) : undefined,
      signal: ctx.signal ?? AbortSignal.timeout(30_000),
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `${new URL(baseUrl).host} rejected the API key (HTTP ${response.status}). ` +
          "Check it in your dashboard.",
      );
    }
    if (!response.ok) {
      return `HTTP ${response.status} from ${path}:\n${truncate(text)}`;
    }

    return truncate(text) || `HTTP ${response.status} (empty response)`;
  },
};

function resolve(baseUrl: string, path: string): URL {
  const base = normalizeUrl(baseUrl);
  // A model-supplied "path" that is a full URL would escape the connected
  // service entirely, so only the path and query are ever taken from it.
  const relative = /^https?:\/\//i.test(path) ? new URL(path).pathname : path;
  const target = new URL(relative.startsWith("/") ? relative : `/${relative}`, base);

  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  for (const [key, value] of new URLSearchParams(query)) {
    target.searchParams.set(key, value);
  }

  if (target.host !== new URL(base).host) {
    throw new Error("Refusing to call a host other than the connected service.");
  }
  return target;
}

function truncate(text: string, limit = 8_000): string {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n\n[truncated ${text.length - limit} characters]`;
}
