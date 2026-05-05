/** Matches the Editor page: toolbar + document canvas */
export default function EditorSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="skeleton h-6 w-36 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-20 rounded-lg" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          {[28, 28, 28, 1, 36, 36, 1, 28, 28, 28].map((w, i) =>
            w === 1 ? (
              <div key={i} className="w-px h-5 bg-slate-200 self-center" />
            ) : (
              <div key={i} className="skeleton h-7 rounded" style={{ width: w }} />
            )
          )}
        </div>

        {/* Document body */}
        <div className="p-8 space-y-4 min-h-96">
          <div className="skeleton h-7 w-64 rounded-lg" />
          <div className="space-y-2">
            {[90, 78, 85, 60, 92, 75, 88, 50].map((w, i) => (
              <div key={i} className="skeleton h-4 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="skeleton h-4 w-0 rounded" />
          <div className="skeleton h-5 w-48 rounded-lg" />
          <div className="space-y-2">
            {[65, 82, 71, 90, 55].map((w, i) => (
              <div key={i} className="skeleton h-4 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
