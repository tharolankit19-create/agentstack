import { z } from "zod";
import { publicUrl } from "./network";
import { fingerprint, redact } from "./policy";

const property = z
  .object({
    type: z.enum(["string", "number", "integer", "boolean"]),
    description: z.string().max(500).optional(),
    enum: z
      .array(z.union([z.string(), z.number(), z.boolean()]))
      .max(100)
      .optional(),
  })
  .strict();
export const adapterInputs = z
  .object({
    type: z.literal("object").default("object"),
    properties: z
      .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,80}$/), property)
      .default({}),
    required: z.array(z.string()).max(30).default([]),
    additionalProperties: z.literal(false).default(false),
  })
  .strict();
export const adapterManifest = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000),
    documentation_url: z.url(),
    version: z.number().int().positive(),
    state: z.enum(["DRAFT", "TESTED", "INSTALLED"]),
    allowed_domains: z
      .array(z.string().regex(/^[a-z0-9.-]+$/))
      .min(1)
      .max(20),
    authentication: z
      .discriminatedUnion("type", [
        z.object({ type: z.literal("none") }).strict(),
        z.object({ type: z.literal("bearer") }).strict(),
        z
          .object({
            type: z.literal("header"),
            header: z.enum(["x-api-key", "api-key"]),
          })
          .strict(),
      ])
      .default({ type: "none" }),
    actions: z
      .array(
        z
          .object({
            name: z
              .string()
              .regex(/^[a-z][a-z0-9_.-]+$/)
              .max(100),
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
            inputs_schema: adapterInputs,
          })
          .strict(),
      )
      .min(1)
      .max(10),
    sandbox_result: z
      .object({
        passed: z.boolean(),
        tested_at: z.string(),
        evidence: z.string().max(4000),
        manifest_hash: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type AdapterManifest = z.infer<typeof adapterManifest>;
export function adapterHash(value: unknown) {
  const {
    state: _state,
    sandbox_result: _test,
    ...definition
  } = adapterManifest.parse(value);
  return fingerprint("adapter.definition", definition);
}
export async function validateAdapter(value: unknown) {
  const m = adapterManifest.parse(value);
  await publicUrl(m.documentation_url);
  const names = new Set<string>();
  for (const action of m.actions) {
    await publicUrl(action.url);
    const url = new URL(action.url);
    if (url.search || url.hash)
      throw new Error(
        "Adapter endpoints must not contain query values or fragments",
      );
    if (!m.allowed_domains.includes(url.hostname))
      throw new Error("Adapter action domain not declared");
    if (names.has(action.name)) throw new Error("Duplicate adapter action");
    names.add(action.name);
    if (action.method !== "GET" && action.risk === "READ")
      throw new Error("Write action cannot claim READ risk");
    if (
      action.inputs_schema.required.some(
        (k) => !Object.hasOwn(action.inputs_schema.properties, k),
      )
    )
      throw new Error("Required adapter input is not declared");
  }
  if (m.state !== "DRAFT" && !m.sandbox_result?.passed)
    throw new Error("Untested adapter cannot be installed");
  return m;
}
export function assertReadAdapter(value: unknown) {
  const m = adapterManifest.parse(value);
  if (m.actions.some((a) => a.method !== "GET" || a.risk !== "READ"))
    throw new Error(
      "Generated write actions are blocked. Only read adapters can be tested and installed.",
    );
  return m;
}
export function installAdapter(value: unknown, approved: boolean) {
  const m = assertReadAdapter(value);
  if (
    !approved ||
    m.state !== "TESTED" ||
    !m.sandbox_result?.passed ||
    m.sandbox_result.manifest_hash !== adapterHash(m)
  )
    throw new Error(
      "Review a passing sandbox test of this exact adapter before installation",
    );
  return { ...m, state: "INSTALLED" as const };
}
export function adapterSecretAccess(value: unknown) {
  const m = adapterManifest.parse(value);
  return (
    m.state === "INSTALLED" &&
    m.sandbox_result?.passed === true &&
    m.sandbox_result.manifest_hash === adapterHash(m)
  );
}
export function adapterRequest(
  value: unknown,
  actionName: string,
  inputs: unknown,
) {
  const m = assertReadAdapter(value),
    a = m.actions.find((a) => a.name === actionName);
  if (!a) throw new Error("Unknown adapter action");
  const parsed = z
    .record(
      z.string(),
      z.union([z.string().max(2000), z.number().finite(), z.boolean()]),
    )
    .parse(inputs);
  for (const key of a.inputs_schema.required)
    if (!Object.hasOwn(parsed, key)) throw new Error("Missing input: " + key);
  const url = new URL(a.url);
  for (const [key, v] of Object.entries(parsed)) {
    const p = a.inputs_schema.properties[key];
    if (!Object.hasOwn(a.inputs_schema.properties, key) || !p)
      throw new Error("Unknown input: " + key);
    if (
      (p.type === "integer" &&
        (!Number.isInteger(v) || typeof v !== "number")) ||
      (p.type !== "integer" && typeof v !== p.type) ||
      (p.enum && !p.enum.includes(v))
    )
      throw new Error("Invalid input: " + key);
    if (/api.?key|secret|token|password|authorization|cookie/i.test(key))
      throw new Error(
        "Credentials must use the server vault, never query inputs",
      );
    url.searchParams.set(key, String(v));
  }
  return { url: url.toString(), action: a };
}
export async function sandboxAdapter(
  value: unknown,
  examples: Record<string, unknown>,
  read: (url: string) => Promise<unknown>,
) {
  const m = assertReadAdapter(await validateAdapter(value));
  if (m.state !== "DRAFT" && m.state !== "TESTED")
    throw new Error(
      "Installed adapters are immutable. Create a new proposal to retest.",
    );
  const results: { action: string; passed: boolean; error?: string }[] = [];
  for (const a of m.actions) {
    try {
      const req = adapterRequest(m, a.name, examples[a.name] ?? {});
      // Sandbox has no credential parameter and never calls the vault.
      await read(req.url);
      results.push({ action: a.name, passed: true });
    } catch (e) {
      results.push({
        action: a.name,
        passed: false,
        error: String(
          redact(e instanceof Error ? e.message : "API test failed"),
        ),
      });
    }
  }
  const passed = results.every((r) => r.passed);
  return {
    manifest: {
      ...m,
      state: passed ? ("TESTED" as const) : ("DRAFT" as const),
      sandbox_result: {
        passed,
        tested_at: new Date().toISOString(),
        manifest_hash: adapterHash(m),
        evidence: JSON.stringify(results),
      },
    },
    results,
  };
}
