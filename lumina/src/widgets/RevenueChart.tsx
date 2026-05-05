/**
 * src/widgets/RevenueChart.tsx
 *
 * Component-level code split — this is a SEPARATE chunk from Dashboard.tsx.
 *
 * Why split at the component level (not just route level)?
 *   Chart.js is ~250KB gzipped. The Dashboard page itself is lightweight,
 *   but importing this widget would drag Chart.js into the dashboard chunk.
 *   By lazy-loading RevenueChart *inside* Dashboard.tsx, we let:
 *     1. The dashboard shell (KPI cards, layout) render immediately
 *     2. The chart widget load and render independently afterward
 *
 * This creates two independent loading phases for one route — the user
 * sees content faster and the chart appears once its chunk is ready.
 *
 * HOW: Dashboard.tsx does:
 *   const RevenueChart = lazy(() => import('./widgets/RevenueChart'))
 *   // ... then wraps it in its own <Suspense fallback={<ChartSkeleton height={280} />}>
 */

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend,
  type TooltipItem,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

// Register only the Chart.js modules this component needs.
// Tree-shaking: unused chart types (Bar, Doughnut, etc.) stay out of this chunk.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const revenue = [28400, 31200, 29800, 34100, 38700, 36200, 41000, 39500, 43200, 46800, 44100, 48295]
const previousYear = revenue.map(v => Math.round(v * 0.78 + Math.random() * 2000))

const data = {
  labels: months,
  datasets: [
    {
      label: 'This year',
      data: revenue,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
    {
      label: 'Last year',
      data: previousYear,
      borderColor: '#e2e8f0',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 4],
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
  ],
}

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      align: 'end' as const,
      labels: { boxWidth: 12, font: { size: 12 }, color: '#64748b' },
    },
    tooltip: {
      callbacks: {
      label: (ctx: TooltipItem<'line'>) =>
          `${ctx.dataset.label ?? ''}: $${(ctx.parsed.y ?? 0).toLocaleString()}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: {
        color: '#94a3b8',
        font: { size: 11 },
        callback: (v: string | number) => `$${Number(v) / 1000}k`,
      },
    },
  },
}

export default function RevenueChart() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Revenue over time</h3>
          <p className="text-xs text-slate-500 mt-0.5">Monthly MRR, current vs prior year</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1 rounded-full">
          +12.5% YoY
        </span>
      </div>
      <div style={{ height: 280 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
