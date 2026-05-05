/** Matches the Reports page: filter bar + data table with rows */
export default function TableSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-1.5">
        <div className="skeleton h-6 w-36 rounded-lg" />
        <div className="skeleton h-4 w-52 rounded" />
      </div>

      {/* Filter row */}
      <div className="flex gap-3">
        <div className="skeleton h-9 flex-1 max-w-xs rounded-lg" />
        <div className="skeleton h-9 w-28 rounded-lg" />
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
          {[120, 150, 200, 100, 90, 100].map((w, i) => (
            <div key={i} className="skeleton h-3 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0">
            {[120, 150, 200, 100, 90, 100].map((w, j) => (
              <div key={j} className="skeleton h-3 rounded" style={{ width: w * (0.7 + Math.random() * 0.4) }} />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-8 w-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
