/**
 * src/components/ui/SafeLazy.tsx
 *
 * The production composition for every lazy-loaded component:
 *
 *   ErrorBoundary           ← catches chunk load failures + render errors
 *     └── Suspense          ← shows fallback while chunk downloads
 *           └── {children}  ← the lazy component
 *
 * The ordering matters: ErrorBoundary MUST wrap Suspense.
 * If Suspense wraps ErrorBoundary and the chunk fails, the thrown error
 * propagates past the ErrorBoundary and crashes the tree.
 *
 * Usage:
 *   <SafeLazy fallback={<DashboardSkeleton />}>
 *     <DashboardPage />   ← must be a React.lazy() component
 *   </SafeLazy>
 */

import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface SafeLazyProps {
  children: ReactNode
  fallback: ReactNode
  /** Optional custom error UI — passed through to ErrorBoundary */
  errorFallback?: (error: Error, retry: () => void) => ReactNode
}

export function SafeLazy({ children, fallback, errorFallback }: SafeLazyProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
