/** Matches the Analytics page layout: header + 3 chart cards */
export default function ChartSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="space-y-1.5">
        <div className="skeleton h-6 w-44 rounded-lg" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>

      {/* Stat summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-6 w-28 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Large line chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-72 w-full rounded-lg" />
      </div>

      {/* Two smaller charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="skeleton h-5 w-32 rounded" />
            <div className="skeleton h-52 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
