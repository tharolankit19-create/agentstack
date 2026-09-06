export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-4 py-4">
    <p className="text-sm text-muted">Opening your workspace…</p>
    <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
    <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
  </div>;
}
