import { createHash } from "node:crypto";
import { z } from "zod";
import type { CompletionContract, Check, VerificationResult } from "./types";
export const LeadSchema = z.object({
  name: z.string().trim().min(3).max(180), company: z.string().trim().min(2).max(180), role: z.string().trim().min(2).max(180),
  sourceUrl: z.url(), identityQuote: z.string().trim().min(15).max(2000), fitQuote: z.string().trim().min(15).max(2000),
  fitReason: z.string().trim().min(15).max(1500), confidence: z.number().min(0.8).max(1),
  draft: z.string().max(2500).default(""), draftQuote: z.string().max(2000).default(""),
}).strict();
export const LeadOutput = z.object({ leads: z.array(LeadSchema).min(1).max(50) }).strict();
export type VerifiedLead = z.infer<typeof LeadSchema>;
export interface SourceSnapshot { url: string; status: number; text: string; sha256: string; capturedAt: string; operationKey?:string; }
export function sourceIsFresh(source:Pick<SourceSnapshot,'capturedAt'>,now=Date.now(),maxAgeSeconds=1800):boolean {
  const captured=Date.parse(source.capturedAt);
  return Number.isFinite(now)&&Number.isFinite(captured)&&Number.isFinite(maxAgeSeconds)&&maxAgeSeconds>0&&captured<=now+30_000&&now-captured<=maxAgeSeconds*1000;
}
export function verificationIsFresh(result:VerificationResult,contract:CompletionContract,now=Date.now()):boolean {
  return sourceIsFresh({capturedAt:result.verifiedAt},now,Number(contract.predicates.find(p=>p.kind==='URL_RESOLVES')?.value??1800));
}
export interface SemanticVerdict { index: number; identitySupported: boolean; fitSupported: boolean; claimsSupported: boolean; reason: string; }
export const SemanticVerdicts = z.object({ verdicts: z.array(z.object({ index: z.number().int().min(0), identitySupported: z.boolean(), fitSupported: z.boolean(), claimsSupported: z.boolean(), reason: z.string().min(1) }).strict()) }).strict();
export function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function contains(text: string, quote: string): boolean { return normalize(text).includes(normalize(quote)); }
export function leadCsv(leads: VerifiedLead[]): string {
  const columns = ["name", "company", "role", "sourceUrl", "fitReason", "confidence", "draft"] as const;
  const cell = (v: string | number) => `"${String(v).replace(/^[\s]*[=+@\-]/, m => `'${m}`).replaceAll('"', '""')}"`;
  return columns.join(",") + "\r\n" + leads.map(l => columns.map(c => cell(l[c])).join(",")).join("\r\n") + "\r\n";
}
export function verifyLeadList(input: {
  contract: CompletionContract; output: unknown; sources: SourceSnapshot[];
  semantic: SemanticVerdict[]; artifact: { content: string; sha256: string } | null;
  workerRunId: string; verifierRunId: string; now?: string;
}): VerificationResult {
  const { contract, output, sources, artifact, workerRunId, verifierRunId } = input;
  const parsed = LeadOutput.safeParse(output);
  const leads = parsed.success ? parsed.data.leads : [];
  const checks: Check[] = [];
  const add = (id: string, passed: boolean, detail: string) => checks.push({ id, passed, detail });
  add("independent_verifier", workerRunId !== verifierRunId && Boolean(workerRunId && verifierRunId), "Worker and verifier must use separate execution runs");
  const sourceFor = (lead: VerifiedLead) => sources.find(s => s.url === lead.sourceUrl);
  const identities = leads.map(l => normalize(l.name));
  const companies = leads.map(l => normalize(l.company));
  for (const p of contract.predicates) {
    switch (p.kind) {
      case "OUTPUT_SCHEMA_VALID": add(p.id, parsed.success && contract.taskClass === "LEAD_LIST", parsed.success ? "Lead schema passed" : "Invalid or incomplete lead fields"); break;
      case "COUNT_EQUALS": add(p.id, leads.length === p.value, `${leads.length}/${p.value} actual leads`); break;
      case "COUNT_AT_LEAST": add(p.id, leads.length >= Number(p.value), `${leads.length} actual leads`); break;
      case "NO_DUPLICATES":
      case "UNIQUE_BY": add(p.id, leads.length > 0 && new Set(identities).size === leads.length && new Set(companies).size === leads.length, "Normalized person and company uniqueness checked"); break;
      case "URL_RESOLVES": add(p.id, leads.length > 0 && leads.every(l => { const s = sourceFor(l); return s && s.status >= 200 && s.status < 300 && s.text.length >= 100 && s.sha256 === digest(s.text)&&sourceIsFresh(s,input.now?Date.parse(input.now):Date.now(),Number(p.value??1800)); }), "Fresh independent public source reads required for every lead"); break;
      case "ARTIFACT_EXISTS": add(p.id, Boolean(parsed.success && artifact && artifact.sha256 === digest(artifact.content) && artifact.content === leadCsv(leads)), "CSV bytes must match the verified output"); break;
      case "FIELD_PRESENT":
      case "FIELD_NONEMPTY": {
        const ok = leads.length > 0 && leads.every(l => {
          if (p.field === "identityQuote") { const s = sourceFor(l); return Boolean(s && contains(s.text, l.identityQuote) && contains(l.identityQuote, l.name) && contains(s.text, l.company) && /founder|co-founder|cofounder|founded/i.test(l.identityQuote) && /founder|co-founder|cofounder/i.test(l.role)); }
          if (p.field === "fitQuote") { const s = sourceFor(l); return Boolean(s && contains(s.text, l.fitQuote)); }
          if (p.field === "draft") { const s = sourceFor(l); return l.draft.trim().length >= 25 && l.draftQuote.trim().length >= 15 && Boolean(s && contains(s.text, l.draftQuote)); }
          return false;
        });
        add(p.id, ok, `Every lead requires supported ${p.field}`); break;
      }
      case "CONFIDENCE_AT_LEAST": add(p.id, leads.length > 0 && leads.every(l => l.confidence >= Number(p.value)), "Confidence threshold checked"); break;
      case "HAS_SOURCE": add(p.id, leads.length > 0 && leads.every(l => Boolean(sourceFor(l))), "Source mapping checked"); break;
      case "NO_UNSUPPORTED_CLAIM": {
        const valid = leads.length > 0 && input.semantic.length === leads.length && new Set(input.semantic.map(v => v.index)).size === leads.length && leads.every((_, index) => input.semantic.some(v => v.index === index && v.identitySupported && v.fitSupported && v.claimsSupported));
        add(p.id, valid && workerRunId !== verifierRunId, "Independent verifier must support identity, fit, and every draft claim"); break;
      }
      default: add(p.id, false, `Unsupported predicate: ${p.kind}`);
    }
  }
  return { passed: checks.length > 0 && checks.every(c => c.passed), checks, failedPredicates: checks.filter(c => !c.passed).map(c => c.id), outputHash: digest(canonical(output)), contractVersion: contract.version, verifiedAt: input.now ?? new Date().toISOString(), verifierRunId };
}
