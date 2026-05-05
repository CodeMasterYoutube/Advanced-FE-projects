/**
 * src/router/index.tsx
 *
 * THE golden rule of lazy loading:
 *   All React.lazy() calls MUST be defined at module scope, never
 *   inside a component or hook. A new lazy() reference on each render
 *   causes React to unmount and remount the entire subtree.
 *
 * Architecture:
 *   - lazy()        → tells React to code-split at this boundary
 *   - preload*()    → duplicate import() for hover-based preloading.
 *                     Browsers cache module requests — no double fetch.
 *   - SafeLazy      → composes ErrorBoundary + Suspense. Every lazy
 *                     component needs both or a network failure silently
 *                     crashes the subtree.
 */

import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import AppShell from '../components/layout/AppShell'
import { SafeLazy } from '../components/ui/SafeLazy'

// Skeletons are eagerly loaded — they are tiny and needed immediately
import PageSkeleton from '../components/ui/skeletons/PageSkeleton'
import DashboardSkeleton from '../components/ui/skeletons/DashboardSkeleton'
import ChartSkeleton from '../components/ui/skeletons/ChartSkeleton'
import TableSkeleton from '../components/ui/skeletons/TableSkeleton'
import EditorSkeleton from '../components/ui/skeletons/EditorSkeleton'

// ─── Lazy page imports ────────────────────────────────────────────────────────
// Each import() call signals Rollup to create a separate .js chunk.
// The chunk is only downloaded when the user first navigates to that route.

const HomePage = lazy(() => import('../pages/Home'))
const DashboardPage = lazy(() => import('../pages/Dashboard'))
const AnalyticsPage = lazy(() => import('../pages/Analytics')) // → chart-vendor chunk
const ReportsPage = lazy(() => import('../pages/Reports'))     // → table-vendor chunk
const EditorPage = lazy(() => import('../pages/Editor'))       // → editor-vendor chunk
const SettingsPage = lazy(() => import('../pages/Settings'))

// ─── Preload functions ────────────────────────────────────────────────────────
// Defined in a separate module to avoid a circular dependency:
//   router/index.tsx → AppShell → Sidebar → router/index.tsx
export {
  preloadHome,
  preloadDashboard,
  preloadAnalytics,
  preloadReports,
  preloadEditor,
  preloadSettings,
} from './preloaders'

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    path: '/',
    // AppShell is ALWAYS eagerly loaded — it contains the nav, sidebar,
    // and global providers. Never lazy-load your app shell.
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <SafeLazy fallback={<PageSkeleton />}>
            <HomePage />
          </SafeLazy>
        ),
      },
      {
        path: 'dashboard',
        element: (
          // DashboardSkeleton matches the real dashboard layout —
          // prevents layout shift when the chunk arrives
          <SafeLazy fallback={<DashboardSkeleton />}>
            <DashboardPage />
          </SafeLazy>
        ),
      },
      {
        path: 'analytics',
        element: (
          <SafeLazy fallback={<ChartSkeleton />}>
            <AnalyticsPage />
          </SafeLazy>
        ),
      },
      {
        path: 'reports',
        element: (
          <SafeLazy fallback={<TableSkeleton />}>
            <ReportsPage />
          </SafeLazy>
        ),
      },
      {
        path: 'editor',
        element: (
          <SafeLazy fallback={<EditorSkeleton />}>
            <EditorPage />
          </SafeLazy>
        ),
      },
      {
        path: 'settings',
        element: (
          <SafeLazy fallback={<PageSkeleton />}>
            <SettingsPage />
          </SafeLazy>
        ),
      },
    ],
  },
])
