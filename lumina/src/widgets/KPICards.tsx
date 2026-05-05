/**
 * src/widgets/KPICards.tsx
 *
 * Eagerly imported by Dashboard.tsx — intentionally NOT lazy-loaded.
 *
 * Why: KPI cards are lightweight (<2KB), above-the-fold, and critical
 * to the dashboard's first meaningful paint. Adding a lazy boundary here
 * would add a network round-trip for negligible savings.
 *
 * Rule of thumb: don't split components smaller than ~10KB gzipped.
 */

interface KPI {
  label: string
  value: string
  change: string
  up: boolean
  icon: React.ReactNode
  iconBg: string
}

const kpis: KPI[] = [
  {
    label: 'Total Revenue',
    value: '$48,295',
    change: '+12.5%',
    up: true,
    iconBg: 'bg-blue-50',
    icon: (
      <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'Active Users',
    value: '3,842',
    change: '+8.1%',
    up: true,
    iconBg: 'bg-violet-50',
    icon: (
      <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    label: 'Conversions',
    value: '1,247',
    change: '+3.2%',
    up: true,
    iconBg: 'bg-emerald-50',
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
      </svg>
    ),
  },
  {
    label: 'Churn Rate',
    value: '2.4%',
    change: '-0.3%',
    up: true,
    iconBg: 'bg-rose-50',
    icon: (
      <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
      </svg>
    ),
  },
]

export default function KPICards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <div className={`${kpi.iconBg} p-1.5 rounded-lg`}>{kpi.icon}</div>
          </div>
          <p className="text-2xl font-semibold text-slate-800 mt-2">{kpi.value}</p>
          <p className={`text-xs font-medium mt-1 ${kpi.up ? 'text-emerald-600' : 'text-red-500'}`}>
            {kpi.change} from last month
          </p>
        </div>
      ))}
    </div>
  )
}
