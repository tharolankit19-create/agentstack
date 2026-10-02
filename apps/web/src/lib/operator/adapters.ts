import { z } from "zod";
import { publicUrl } from "./network";
// Generated adapters are inert manifests until a sandbox test and explicit installation.
export const adapterManifest = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  documentation_url: z.url(),
  version: z.number().int().positive(),
  state: z.enum(["DRAFT", "TESTED", "INSTALLED"]),
  allowed_domains: z.array(z.string()).min(1).max(20),
  actions: z
    .array(
      z.object({
        name: z.string().regex(/^[a-z][a-z0-9_.-]+$/),
        method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
        url: z.url(),
        risk: z.enum([
          "READ",
          "SAFE_WRITE",
          "EXTERNAL_COMMUNICATION",
          "PUBLIC_PUBLISH",
          "FINANCIAL",
          "DESTRUCTIVE",
          "SECURITY",
        ]),
        inputs_schema: z.record(z.string(), z.unknown()),
        secret_reference: z.string().optional(),
      }),
    )
    .min(1)
    .max(30),
  sandbox_result: z
    .object({
      passed: z.boolean(),
      tested_at: z.string(),
      evidence: z.string().max(4000),
    })
    .optional(),
});
export async function validateAdapter(value: unknown) {
  const manifest = adapterManifest.parse(value);
  for (const action of manifest.actions) {
    await publicUrl(action.url);
    if (!manifest.allowed_domains.includes(new URL(action.url).hostname))
      throw new Error("Adapter action domain not declared");
    if (action.method !== "GET" && action.risk === "READ")
      throw new Error("Write action cannot claim READ risk");
  }
  if (manifest.state !== "DRAFT" && !manifest.sandbox_result?.passed)
    throw new Error("Untested adapter cannot be installed");
  return manifest;
}
export function installAdapter(value: unknown, approved: boolean) {
  const m = adapterManifest.parse(value);
  if (!approved || m.state !== "TESTED" || !m.sandbox_result?.passed)
    throw new Error("Review a passing sandbox test before installation");
  return { ...m, state: "INSTALLED" as const };
}
export function adapterSecretAccess(value: unknown) {
  return adapterManifest.parse(value).state === "INSTALLED";
}
