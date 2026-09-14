export default function DashboardLoading() {
  return <div role="status" aria-label="Loading workspace" className="space-y-5"><p className="text-sm text-muted">Opening workspace…</p><div className="h-8 w-48 animate-pulse rounded-lg bg-surface-3" /><div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border border-line bg-surface-2" />)}</div></div>;
}
