# Lumina — Advanced Frontend Concepts Demo

A SaaS dashboard built to demonstrate production-grade frontend patterns in React + TypeScript + Vite. Every file is intentionally written to teach a specific concept.

---

## Table of Contents

1. [Code Splitting — Route Level](#1-code-splitting--route-level)
2. [Code Splitting — Component Level](#2-code-splitting--component-level)
3. [Eager Loading — When NOT to Split](#3-eager-loading--when-not-to-split)
4. [The Module-Scope Rule for lazy()](#4-the-module-scope-rule-for-lazy)
5. [Vite Manual Chunks & Vendor Isolation](#5-vite-manual-chunks--vendor-isolation)
6. [Suspense Boundaries & Skeleton Fallbacks](#6-suspense-boundaries--skeleton-fallbacks)
7. [Multiple Independent Suspense Boundaries](#7-multiple-independent-suspense-boundaries)
8. [Skeleton Shimmer Animation](#8-skeleton-shimmer-animation)
9. [Error Boundaries](#9-error-boundaries)
10. [The SafeLazy Composition Pattern](#10-the-safelazy-composition-pattern)
11. [React Router v7 — createBrowserRouter](#11-react-router-v7--createbrowserrouter)
12. [Nested Routes & Outlet](#12-nested-routes--outlet)
13. [NavLink Active State & the end Prop](#13-navlink-active-state--the-end-prop)
14. [Hover-Based Preloading](#14-hover-based-preloading)
15. [Above-Fold vs Below-Fold Split Decisions](#15-above-fold-vs-below-fold-split-decisions)
16. [Circular Dependency Detection & Fix](#16-circular-dependency-detection--fix)
17. [TanStack Table v8 — Sorting](#17-tanstack-table-v8--sorting)
18. [TanStack Table v8 — Filtering](#18-tanstack-table-v8--filtering)
19. [TanStack Table v8 — Pagination](#19-tanstack-table-v8--pagination)
20. [Chart.js Tree-Shaking via Selective Registration](#20-chartjs-tree-shaking-via-selective-registration)
21. [Chart Types — Bar, Line, Doughnut](#21-chart-types--bar-line-doughnut)
22. [Controlled Markdown Editor](#22-controlled-markdown-editor)
23. [Shared Domain Types in TypeScript](#23-shared-domain-types-in-typescript)
24. [Discriminated Union Types](#24-discriminated-union-types)
25. [Tailwind Custom Animation with @layer](#25-tailwind-custom-animation-with-layer)

---

## 1. Code Splitting — Route Level

**What:** Each route is a separate JavaScript chunk that only downloads when the user first navigates to it. Users who only visit `/` never download Chart.js, TanStack Table, or the markdown editor.

**How:** `React.lazy()` wraps a dynamic `import()`. Rollup (via Vite) sees the dynamic import and emits a separate `.js` file for it.

**Where:** `src/router/index.tsx`

```ts
const AnalyticsPage = lazy(() => import('../pages/Analytics'))  // → chart-vendor chunk
const ReportsPage   = lazy(() => import('../pages/Reports'))    // → table-vendor chunk
const EditorPage    = lazy(() => import('../pages/Editor'))     // → editor-vendor chunk
```

**Verify:** Open DevTools → Network → JS. Navigate between routes and watch new `.js` files arrive on first visit only.

---

## 2. Code Splitting — Component Level

**What:** A single route can have multiple lazy boundaries. The Dashboard splits its heavy widgets from its page shell, creating three independent loading phases for one route: shell renders first, then chart, then feed — in parallel.

**How:** `lazy()` is called for individual components inside a page file, not just at the router level.

**Where:** `src/pages/Dashboard.tsx`

```ts
// These are module-scope constants — initialized once when Dashboard.tsx loads
const RevenueChart = lazy(() => import('../widgets/RevenueChart'))  // Chart.js chunk
const ActivityFeed = lazy(() => import('../widgets/ActivityFeed'))  // separate chunk
```

Each gets its own `<Suspense fallback={...}>` so they load and render independently.

---

## 3. Eager Loading — When NOT to Split

**What:** Code splitting has a cost — an extra network round-trip. Small, above-fold, always-needed components should be eagerly imported.

**Rule of thumb:** Don't split components smaller than ~10KB gzipped. The round-trip latency costs more than the bytes saved.

**Where:**
- `src/components/layout/AppShell.tsx` — always eagerly imported (it's the shell)
- `src/components/layout/Sidebar.tsx` — always eagerly imported (nav is always visible)
- `src/widgets/KPICards.tsx` — eagerly imported by Dashboard.tsx (lightweight, above-fold)
- All skeleton components — eagerly imported (needed immediately as fallbacks)

---

## 4. The Module-Scope Rule for lazy()

**What:** `React.lazy()` calls MUST be at module scope — never inside a component function or hook. A new `lazy()` reference created on each render forces React to unmount and remount the entire subtree on every render.

**Where:** `src/router/index.tsx` (router-level splits) and `src/pages/Dashboard.tsx` (component-level splits) — both place `lazy()` at the top of the module, outside any function.

```ts
// ✅ Correct — module scope, initialized once
const RevenueChart = lazy(() => import('../widgets/RevenueChart'))

export default function Dashboard() {
  // ❌ Wrong — new lazy() reference on every render
  // const RevenueChart = lazy(() => import('../widgets/RevenueChart'))
  return <RevenueChart />
}
```

---

## 5. Vite Manual Chunks & Vendor Isolation

**What:** By default Vite auto-splits route chunks, but vendor libraries (React, Chart.js, etc.) may end up scattered. `manualChunks` pins specific packages into named, stable chunks that browsers can cache long-term across deploys.

**Where:** `vite.config.ts`

```ts
manualChunks(id) {
  if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor'
  if (id.includes('chart.js') || id.includes('react-chartjs-2'))  return 'chart-vendor'
  if (id.includes('@tanstack'))                                    return 'table-vendor'
  if (id.includes('@uiw') || id.includes('@codemirror'))          return 'editor-vendor'
}
```

**Why it matters:** `react-vendor` almost never changes between deploys, so users keep it cached indefinitely. Only the route chunk that actually changed needs to be re-downloaded.

---

## 6. Suspense Boundaries & Skeleton Fallbacks

**What:** Every `lazy()` component needs a `<Suspense>` ancestor. While the chunk downloads, React renders the `fallback`. Route-matched skeletons (matching the real layout) prevent jarring layout shifts when the chunk arrives.

**Where:** `src/router/index.tsx` — each route has a skeleton matched to its content:

```tsx
<SafeLazy fallback={<DashboardSkeleton />}><DashboardPage /></SafeLazy>
<SafeLazy fallback={<ChartSkeleton />}><AnalyticsPage /></SafeLazy>
<SafeLazy fallback={<TableSkeleton />}><ReportsPage /></SafeLazy>
<SafeLazy fallback={<EditorSkeleton />}><EditorPage /></SafeLazy>
```

Skeletons are in `src/components/ui/skeletons/`.

---

## 7. Multiple Independent Suspense Boundaries

**What:** When a page has multiple lazy components, wrapping all of them in a single `<Suspense>` means the slowest one blocks all others. Giving each its own boundary lets them resolve and paint independently — whichever chunk arrives first renders first.

**Where:** `src/pages/Dashboard.tsx`

```tsx
<Suspense fallback={<ChartSkeleton />}>
  <RevenueChart />   {/* renders as soon as chart chunk arrives */}
</Suspense>

<Suspense fallback={<FeedSkeleton />}>
  <ActivityFeed />   {/* renders as soon as feed chunk arrives */}
</Suspense>
```

The two chunks download in parallel. If ActivityFeed loads first, it renders before RevenueChart.

---

## 8. Skeleton Shimmer Animation

**What:** Skeleton screens give users a perceived sense of progress. A shimmer (moving highlight) makes skeletons feel alive rather than frozen.

**How:** A CSS `@keyframes` animation moves a gradient across the element. Defined globally so any element with `className="skeleton"` gets the effect.

**Where:** `src/index.css`

```css
@layer components {
  .skeleton {
    @apply rounded bg-slate-200 relative overflow-hidden;
  }
  .skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite linear;
  }
}
```

---

## 9. Error Boundaries

**What:** Network failures or render errors inside a lazy component would otherwise crash the entire React tree silently. An Error Boundary catches these, shows a recovery UI, and provides a retry button that re-triggers the lazy import.

**Why class component:** React has no hooks equivalent for `getDerivedStateFromError` and `componentDidCatch`. Error boundaries must be class components.

**Where:** `src/components/ui/ErrorBoundary.tsx`

Key pattern — the retry mechanism:
```ts
handleRetry = () => {
  // Resetting state causes React to re-render children,
  // which re-triggers the lazy import() — a fresh fetch attempt.
  this.setState({ hasError: false, error: null })
}
```

---

## 10. The SafeLazy Composition Pattern

**What:** Every lazy component needs both `ErrorBoundary` AND `Suspense`. `SafeLazy` composes them so you never forget one.

**Order matters:** `ErrorBoundary` MUST wrap `Suspense`. If inverted, a chunk load failure throws past the boundary and crashes the tree.

**Where:** `src/components/ui/SafeLazy.tsx`

```tsx
// ✅ Correct order
<ErrorBoundary>
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
</ErrorBoundary>
```

---

## 11. React Router v7 — createBrowserRouter

**What:** The data router API (`createBrowserRouter` + `RouterProvider`) is the modern React Router approach, replacing the JSX `<BrowserRouter>` wrapper. It enables future data loading features (loaders, actions) and is the foundation for frameworks like Remix.

**Where:** `src/router/index.tsx` (router definition), `src/main.tsx` (RouterProvider)

```tsx
// main.tsx
<RouterProvider router={router} />
```

---

## 12. Nested Routes & Outlet

**What:** Child routes render inside their parent via `<Outlet />`. The `AppShell` (sidebar + main area) is the parent; each page is a child. This means the shell is always present and only the content area swaps on navigation.

**Where:** `src/components/layout/AppShell.tsx` renders `<Outlet />`, `src/router/index.tsx` defines the nesting.

```tsx
// router/index.tsx
{ path: '/', element: <AppShell />, children: [
  { index: true, element: <HomePage /> },
  { path: 'dashboard', element: <DashboardPage /> },
  // ...
]}
```

---

## 13. NavLink Active State & the end Prop

**What:** `NavLink` automatically applies a class when its route is active. The `end` prop is critical for the root `/` route — without it, `/` matches every path (since all routes start with `/`), making the Home link always appear active.

**Where:** `src/components/layout/Sidebar.tsx`

```tsx
<NavLink
  to="/"
  end  // ← only active when path is exactly "/"
  className={({ isActive }) =>
    isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
  }
>
```

---

## 14. Hover-Based Preloading

**What:** When a user hovers a nav link, the chunk fetch starts ~200–400ms before they click. By the time they finish clicking, the chunk is already downloaded or well underway. This makes navigation feel instant.

**How:** `onMouseEnter` (and `onFocus` for keyboard users) calls the page's `import()` early. Browsers cache module requests — calling `import()` on an already-loaded module is a no-op.

**Where:** `src/components/layout/Sidebar.tsx` + `src/router/preloaders.ts`

```tsx
<NavLink onMouseEnter={() => item.preload?.()} onFocus={() => item.preload?.()}>
```

```ts
// preloaders.ts
export const preloadAnalytics = () => import('../pages/Analytics')
```

---

## 15. Above-Fold vs Below-Fold Split Decisions

**What:** Whether to lazy-load a component is a judgment call. The framework for deciding:

| Factor | Eager | Lazy |
|---|---|---|
| Is it above the fold? | ✅ Eager | — |
| Is it always visible? | ✅ Eager | — |
| Size < 10KB gzipped? | ✅ Eager | — |
| Heavy library (Chart.js, CodeMirror)? | — | ✅ Lazy |
| Below the fold / requires scroll? | — | ✅ Lazy |
| Only some users visit? | — | ✅ Lazy |

**Example in this project:** `KPICards` is eagerly imported by Dashboard (above fold, tiny). `RevenueChart` and `ActivityFeed` are lazily imported (heavy/below fold).

---

## 16. Circular Dependency Detection & Fix

**What:** A circular import chain causes a `ReferenceError: Cannot access '...' before initialization` crash. The module being imported hasn't finished its own initialization when it's first accessed.

**The cycle in this project:**
```
router/index.tsx → AppShell → Sidebar → router/index.tsx (not done yet!)
```

**Fix:** Extract the shared values (preload functions) into a third module that neither side of the cycle depends on.

**Where:** `src/router/preloaders.ts` was created to break the cycle. `Sidebar.tsx` now imports from `preloaders.ts` directly instead of from `router/index.tsx`.

---

## 17. TanStack Table v8 — Sorting

**What:** Click a column header to sort ascending → descending → unsorted. TanStack Table handles the sort state and row ordering; you only provide the UI.

**Where:** `src/pages/Reports.tsx`

```ts
const [sorting, setSorting] = useState<SortingState>([])

const table = useReactTable({
  state: { sorting },
  onSortingChange: setSorting,
  getSortedRowModel: getSortedRowModel(),
})

// In JSX — onClick wires to TanStack's handler
<th onClick={header.column.getToggleSortingHandler()}>
  {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
</th>
```

---

## 18. TanStack Table v8 — Filtering

**What:** Two filter modes work simultaneously — a global text search across all columns, and a status dropdown that pre-filters the data before it reaches the table.

**Where:** `src/pages/Reports.tsx`

```ts
const [globalFilter, setGlobalFilter] = useState('')

const table = useReactTable({
  state: { globalFilter },
  onGlobalFilterChange: setGlobalFilter,
  getFilteredRowModel: getFilteredRowModel(),
})
```

The status filter is applied upstream via `useMemo` before the data reaches the table, which is more efficient for known-value filters.

---

## 19. TanStack Table v8 — Pagination

**What:** Client-side pagination splits rows into pages without any server calls. Page count, current page, and navigation are all derived from table state.

**Where:** `src/pages/Reports.tsx`

```ts
const table = useReactTable({
  getPaginationRowModel: getPaginationRowModel(),
  initialState: { pagination: { pageSize: 10 } },
})

// Navigate
table.previousPage()
table.nextPage()
table.setPageIndex(i)
table.getCanPreviousPage()  // for disabling buttons
```

---

## 20. Chart.js Tree-Shaking via Selective Registration

**What:** Chart.js is large (~250KB). It ships every chart type, scale, and plugin in one package. The `ChartJS.register()` pattern lets you import and register only what you use — unused chart types stay out of the bundle entirely.

**Where:** `src/pages/Analytics.tsx` and `src/widgets/RevenueChart.tsx`

```ts
// Only register what this file actually uses:
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
// Bar, Line, Doughnut, etc. that aren't registered here are tree-shaken out
```

Note: `RevenueChart.tsx` only registers `LineElement` (not `BarElement`) because it only renders a line chart.

---

## 21. Chart Types — Bar, Line, Doughnut

**What:** Three Chart.js chart types demonstrated with real configuration patterns.

**Where:** `src/pages/Analytics.tsx` — all three on one page
- **Bar** (`<Bar>`) — stacked traffic by acquisition source
- **Line** (`<Line>`) — conversion rate trend with area fill
- **Doughnut** (`<Doughnut>`) — channel share with center cutout

`src/widgets/RevenueChart.tsx` — revenue over time with a dashed prior-year comparison line.

Key options demonstrated: `responsive`, `maintainAspectRatio: false`, custom tooltip `callbacks`, axis `ticks.callback` formatters.

---

## 22. Controlled Markdown Editor

**What:** `@uiw/react-md-editor` renders a split-pane markdown editor with live preview. It follows React's controlled component pattern — state lives in the parent, the editor is a pure view.

**Where:** `src/pages/Editor.tsx`

```tsx
const [content, setContent] = useState(INITIAL_CONTENT)

<MDEditor
  value={content}
  onChange={(val) => setContent(val ?? '')}
  height={560}
  preview="live"
/>
```

The `?? ''` guard handles the edge case where MDEditor calls `onChange` with `undefined` when the editor is cleared.

---

## 23. Shared Domain Types in TypeScript

**What:** Domain types (the shape of your data) are defined once and imported everywhere. This ensures the table, charts, and widgets all agree on what a `Transaction` or `ActivityItem` looks like.

**Where:** `src/types/index.ts`

```ts
export interface Transaction {
  id: string
  status: 'completed' | 'pending' | 'failed'  // discriminated union
  amount: number
  // ...
}
```

---

## 24. Discriminated Union Types

**What:** Instead of `string` for fields like `status` or `type`, a union of string literals constrains the value to a known set. TypeScript will error if you mistype a value, and you get autocomplete everywhere the type is used.

**Where:** `src/types/index.ts`

```ts
status: 'completed' | 'pending' | 'failed'
type:   'signup' | 'purchase' | 'upgrade' | 'cancellation' | 'comment'
```

Used in `src/pages/Reports.tsx` to build a type-safe status→style map:
```ts
const styles = {
  completed: 'bg-emerald-50 text-emerald-700',
  pending:   'bg-amber-50 text-amber-700',
  failed:    'bg-red-50 text-red-600',
}
// TypeScript errors if status is not one of the three keys
```

---

## 25. Tailwind Custom Animation with @layer

**What:** Tailwind's `@layer components` lets you define reusable utility classes that participate in Tailwind's purging (unused class removal in production builds). Putting custom CSS inside `@layer` instead of bare CSS ensures it's only included when the class is actually used.

**Where:** `src/index.css`

```css
@layer components {
  .skeleton { @apply rounded bg-slate-200 relative overflow-hidden; }
  .skeleton::after { /* shimmer pseudo-element */ }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

The `shimmer` keyframe is also registered in `tailwind.config.js` under `theme.extend.animation` so it can be used as `animate-shimmer` via Tailwind utilities.

---

## Project File Map

```
src/
├── main.tsx                          # App entry, RouterProvider
├── index.css                         # Tailwind + skeleton/shimmer styles  [#8, #25]
├── types/index.ts                    # Shared domain types                 [#23, #24]
├── router/
│   ├── index.tsx                     # Route definitions, lazy imports      [#1, #4, #6, #11, #12]
│   └── preloaders.ts                 # Preload functions (cycle-free)       [#14, #16]
├── pages/
│   ├── Home.tsx                      # Lightweight overview page
│   ├── Dashboard.tsx                 # Component-level splits               [#2, #7]
│   ├── Analytics.tsx                 # Chart.js — Bar, Line, Doughnut       [#20, #21]
│   ├── Reports.tsx                   # TanStack Table                        [#17, #18, #19]
│   ├── Editor.tsx                    # Markdown editor                       [#22]
│   └── Settings.tsx                  # Form patterns, toggle components
├── widgets/
│   ├── KPICards.tsx                  # Eager — above fold, lightweight       [#3, #15]
│   ├── RevenueChart.tsx              # Lazy — Chart.js line chart            [#2, #20, #21]
│   └── ActivityFeed.tsx              # Lazy — below fold                     [#2, #15]
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx              # Shell + Outlet                        [#3, #12]
│   │   └── Sidebar.tsx               # NavLink, hover preloading             [#13, #14]
│   └── ui/
│       ├── SafeLazy.tsx              # ErrorBoundary + Suspense composition  [#10]
│       ├── ErrorBoundary.tsx         # Class component, retry logic          [#9]
│       └── skeletons/                # Route-matched loading skeletons       [#6, #8]
└── assets/
    └── hero.png                      # Lumina brand mark
```
