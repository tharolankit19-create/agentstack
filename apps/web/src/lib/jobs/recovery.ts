export const FAILURE_CATEGORIES = ['selector_missing','page_changed','wrong_state','network_timeout','provider_timeout','rate_limited','auth_expired','captcha','2fa_required','browser_crashed','session_expired','tool_failed','model_failed','verification_failed','source_unavailable','output_invalid','credit_cap','configuration_missing'] as const;
export type FailureCategory = typeof FAILURE_CATEGORIES[number];
export class JobFailure extends Error {
  constructor(public category: FailureCategory, message: string) { super(message); this.name = 'JobFailure'; }
}
export function failureOf(cause: unknown): JobFailure {
  if (cause instanceof JobFailure) return cause;
  if (cause instanceof Error && /Timeout|Abort/.test(cause.name)) return new JobFailure('network_timeout','An external request timed out.');
  return new JobFailure('tool_failed',cause instanceof Error ? cause.message.slice(0,500) : 'An execution tool failed.');
}
export function recoveryDecision(category: FailureCategory, attempt: number, maxAttempts: number): 'retry' | 'needs_user' | 'fail' {
  if (['auth_expired','captcha','2fa_required','credit_cap','configuration_missing'].includes(category)) return 'needs_user';
  return attempt < maxAttempts ? 'retry' : 'fail';
}
