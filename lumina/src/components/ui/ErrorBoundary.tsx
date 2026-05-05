/**
 * src/components/ui/ErrorBoundary.tsx
 *
 * Error boundaries MUST be class components — React has no hooks equivalent
 * for getDerivedStateFromError / componentDidCatch.
 *
 * This boundary handles two failure modes:
 *   1. Lazy chunk fails to load (network error, 404 on deploy)
 *   2. Component throws during render (runtime bug)
 *
 * The "Retry" button resets state, which causes React to re-attempt
 * rendering children — this re-triggers the lazy import(), allowing
 * a user on a flaky connection to recover without a full page reload.
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom error UI. Defaults to the built-in fallback. */
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    // This runs during render — update state so the next render shows the fallback
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // ─── Production integration point ────────────────────────────────────────
    // Replace console.error with your monitoring service:
    //   Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
    //   datadogRum.addError(error, { componentStack: info.componentStack })
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  handleRetry = () => {
    // Resetting hasError causes React to re-render children,
    // which re-triggers the lazy import() — a fresh attempt.
    this.setState({ hasError: false, error: null })
  }

  render() {
    const { hasError, error } = this.state

    if (!hasError || !error) return this.props.children

    // Custom fallback renderer
    if (this.props.fallback) {
      return this.props.fallback(error, this.handleRetry)
    }

    // Default built-in fallback
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 p-8">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-medium text-sm">Failed to load this section</p>
          <p className="text-slate-400 text-xs mt-1">
            {error.message.includes('fetch')
              ? 'Network error — check your connection'
              : 'An unexpected error occurred'}
          </p>
        </div>
        <button
          onClick={this.handleRetry}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          Try again
        </button>
      </div>
    )
  }
}
