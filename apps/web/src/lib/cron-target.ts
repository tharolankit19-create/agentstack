/** Only trusted server configuration can select a worker dispatch origin. */
export function cronTarget(env: Record<string, string | undefined>): { origin: string; bypass?: string } | null {
  const deployment = env.VERCEL_URL?.trim();
  const isVercel = env.VERCEL === '1' || Boolean(env.VERCEL_ENV) || Boolean(deployment);
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
  const isolated = isVercel && (env.VERCEL_ENV !== 'production' || !explicit);
  // An isolated preview must never fall back to a production canonical URL.
  // Production retains its configured canonical target, which can be public
  // even when generated deployment URLs require an automation credential.
  const raw = isolated ? (deployment ? `https://${deployment.replace(/^https:\/\//, '')}` : '') : explicit;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && !isVercel)) return null;
    if (isolated && !url.hostname.endsWith('.vercel.app')) return null;
    const bypass = isolated ? env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() : undefined;
    return { origin: url.origin, ...(bypass ? { bypass } : {}) };
  } catch { return null; }
}
