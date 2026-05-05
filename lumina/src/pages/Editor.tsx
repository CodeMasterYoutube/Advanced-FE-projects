/**
 * src/pages/Editor.tsx
 *
 * Heavy route — imports @uiw/react-md-editor (~350KB gzipped with codemirror deps).
 * Goes into the 'editor-vendor' chunk configured in vite.config.ts.
 *
 * This is one of the highest-value code splits in any SaaS app.
 * Rich text and code editors are universally large libraries that only
 * a fraction of users (editors/admins) will actually need.
 *
 * The pattern: wrap the entire editor import in a lazy boundary so that
 * users who visit any other part of the app never download it.
 */

import { useState, useCallback } from "react";
import MDEditor from "@uiw/react-md-editor";

const INITIAL_CONTENT = `# Q3 2025 Engineering Report

## Executive Summary

This quarter we shipped **3 major features** and resolved **47 bugs**, 
bringing our overall platform stability score to **98.7%** uptime.

## Key Deliverables

### 1. Code Splitting Implementation
Reduced initial bundle size by **68%** by implementing route-based and 
component-level lazy loading across all 6 main routes.

\`\`\`typescript
// Before: one 3.2MB monolith
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'

// After: lazy-loaded, demand-driven chunks
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Analytics = lazy(() => import('./pages/Analytics'))
\`\`\`

### 2. Error Boundary Coverage
All lazy components now wrapped in \`ErrorBoundary + Suspense\` boundaries,
with retry logic and Sentry error reporting.

### 3. Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial JS | 3.2 MB | 1.02 MB | -68% |
| TTI | 4.2s | 1.4s | -67% |
| LCP | 3.8s | 1.1s | -71% |
| Coverage (unused JS) | 74% | 18% | -56pp |

## Next Steps

- [ ] Implement intersection-observer based lazy loading for below-fold content
- [ ] Add Service Worker for chunk prefetching on repeat visits
- [ ] Set up bundle size CI gate (fail build if chunk > 500KB)
`;

export default function Editor() {
  const [content, setContent] = useState(INITIAL_CONTENT);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    // In production: POST to your API
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return (
    <div className="p-6 space-y-4" data-color-mode="light">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Document Editor
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Markdown editor — loaded on demand (~350KB saved on initial load)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
              Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3.5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Save
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span>{content.split(/\s+/).filter(Boolean).length} words</span>
        <span>{content.length} characters</span>
        <span>{content.split("\n").length} lines</span>
      </div>

      {/* Editor — @uiw/react-md-editor renders here */}
      <div className="rounded-xl overflow-hidden border border-slate-200">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val ?? "")}
          height={560}
          preview="live"
          hideToolbar={false}
          visibleDragbar={false}
        />
      </div>
    </div>
  );
}
