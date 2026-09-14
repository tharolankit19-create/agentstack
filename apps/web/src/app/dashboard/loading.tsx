export default function DashboardLoading() {
  return (
    <div className="max-w-5xl space-y-5" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-surface-3" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-surface-3/80" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-line bg-surface-2" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[22px] border border-line bg-surface-2" />
    </div>
  );
}
