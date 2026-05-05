/**
 * src/pages/Dashboard.tsx
 *
 * Demonstrates COMPONENT-LEVEL code splitting inside a lazy route.
 *
 * Loading hierarchy:
 *   1. User navigates → router's SafeLazy shows DashboardSkeleton
 *   2. Dashboard chunk downloads → page shell (header + KPICards) renders FIRST
 *   3. RevenueChart chunk downloads independently → chart appears
 *   4. ActivityFeed chunk downloads independently → feed appears below
 *
 * This creates three independent rendering phases for one route,
 * allowing above-fold content to paint before heavy Chart.js loads.
 *
 * Key rule: lazy() calls are at module scope (top level of this file),
 * NOT inside the Dashboard component function.
 */

import { lazy, Suspense } from 'react'

// KPICards is EAGERLY imported — it's lightweight (<2KB) and above-the-fold.
// Adding a lazy boundary here would hurt TTI for zero meaningful savings.
import KPICards from '../widgets/KPICards'

// Component-level lazy splits — each becomes its own chunk.
// These are module-scope constants, initialized once when Dashboard.tsx first loads.
const RevenueChart = lazy(() =>
  // This import() pulls in chart.js + react-chartjs-2 (~250KB gzipped).
  // It only downloads when Dashboard renders, and only on the first visit.
  import('../widgets/RevenueChart')
)

const ActivityFeed = lazy(() =>
  // Separate chunk for the feed — allows it to load independently of the chart.
  import('../widgets/ActivityFeed')
)

// Inline skeleton for the chart area — small enough to inline here
function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-3 w-52 rounded" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-72 w-full rounded-lg" />
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse space-y-3">
      <div className="skeleton h-4 w-32 rounded" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 rounded" style={{ width: `${50 + i * 9}%` }} />
            <div className="skeleton h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your key metrics for June 2025</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export
        </button>
      </div>

      {/*
        KPICards: eagerly imported — renders immediately when this chunk lands.
        No Suspense needed because it has no lazy dependencies.
      */}
      <KPICards />

      {/*
        RevenueChart: component-level lazy split.
        ChartSkeleton shows while chart.js chunk downloads.
        Independent from the feed — resolves as soon as its own chunk arrives.
      */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      {/*
        ActivityFeed: another independent lazy split.
        Its chunk fetches in parallel with RevenueChart's chunk —
        whichever arrives first renders first.
      */}
      <Suspense fallback={<FeedSkeleton />}>
        <ActivityFeed />
      </Suspense>
    </div>
  )
}
