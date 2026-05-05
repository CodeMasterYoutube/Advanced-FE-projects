/**
 * src/pages/Home.tsx
 *
 * Lightweight overview page — no heavy dependencies.
 * This chunk will be small (~5KB), making it a fast initial load.
 * Users who only visit the home page never pay for Chart.js, React-Table,
 * or the markdown editor — they're in separate chunks.
 */

const stats = [
  { label: 'Monthly Recurring Revenue', value: '$48,295', change: '+12.5%', up: true },
  { label: 'Active Users',              value: '3,842',   change: '+8.1%',  up: true },
  { label: 'Churn Rate',               value: '2.4%',    change: '-0.3%',  up: true },
  { label: 'Avg. Session Duration',    value: '4m 32s',  change: '+23s',   up: true },
]

const quickLinks = [
  { label: 'View Dashboard',   href: '/dashboard', desc: 'KPIs and revenue charts',      color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { label: 'Open Analytics',   href: '/analytics', desc: 'Traffic and conversion data',  color: 'bg-violet-50 text-violet-700 border-violet-100' },
  { label: 'Browse Reports',   href: '/reports',   desc: 'Transaction and billing data', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { label: 'Open Editor',      href: '/editor',    desc: 'Create and edit documents',    color: 'bg-amber-50 text-amber-700 border-amber-100' },
]

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Good morning 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">Here's what's happening with Lumina today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-2xl font-semibold text-slate-800 mt-1">{s.value}</p>
            <p className={`text-xs mt-1 font-medium ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {s.change} vs last month
            </p>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-3">Quick access</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`block p-4 rounded-xl border ${link.color} hover:opacity-80 transition-opacity`}
            >
              <p className="font-medium text-sm">{link.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{link.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Code splitting note — educational, remove in real app */}
      <div className="bg-slate-800 rounded-xl p-5 text-sm">
        <p className="text-slate-300 font-medium mb-1">
          Code splitting in action
        </p>
        <p className="text-slate-500 text-xs leading-relaxed">
          This page downloaded only the <code className="text-blue-400">home</code> chunk (~5KB).
          Navigate to Analytics or Reports and watch the Network tab — you'll see new
          <code className="text-blue-400"> .js</code> files arrive on demand.
          The Chart.js and React-Table chunks only download when you first visit those routes.
        </p>
      </div>
    </div>
  )
}
