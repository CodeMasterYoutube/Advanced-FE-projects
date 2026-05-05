/**
 * src/components/layout/AppShell.tsx
 *
 * The AppShell is ALWAYS eagerly imported — it contains the chrome
 * (nav, sidebar) that must be available on every render. Never lazy-load
 * structural layout components.
 *
 * Renders:
 *   Sidebar (fixed left) + main area (scrollable right)
 *   Outlet renders the current route's lazy-loaded page component.
 */

import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar: always present, eagerly loaded */}
      <Sidebar />

      {/* Main content: scrollable, renders active route */}
      <main className="flex-1 overflow-y-auto">
        {/*
          <Outlet /> renders the matched child route element.
          Each route is wrapped in SafeLazy (see router/index.tsx),
          so Suspense + ErrorBoundary is already in place.
        */}
        <Outlet />
      </main>
    </div>
  )
}
