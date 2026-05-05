/**
 * DashboardSkeleton exactly mirrors Dashboard.tsx's layout:
 *   - 4 KPI cards in a row
 *   - Large chart area
 *   - Activity feed list
 *
 * Matching the real layout prevents content shift (CLS) when the
 * chunk resolves and Suspense replaces this with the real component.
 */
export default function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="skeleton h-6 w-40 rounded-lg" />
          <div className="skeleton h-4 w-56 rounded" />
        </div>
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>

      {/* KPI cards — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
            <div className="skeleton h-7 w-28 rounded-lg" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-5 w-36 rounded" />
          <div className="skeleton h-7 w-24 rounded-lg" />
        </div>
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="skeleton h-5 w-32 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 rounded" style={{ width: `${50 + i * 8}%` }} />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
