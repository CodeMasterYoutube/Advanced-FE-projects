/**
 * src/pages/Analytics.tsx
 *
 * Heavy route — imports Chart.js (~250KB gzipped).
 * This entire file + chart.js goes into the 'chart-vendor' chunk
 * (configured in vite.config.ts manualChunks).
 *
 * Because it's lazy-loaded via router/index.tsx, a user who never
 * visits /analytics never downloads this chunk.
 *
 * Chart.js pattern: register only what you use.
 * Registering unused chart types still adds them to the bundle.
 */

import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  ArcElement, Filler, Tooltip, Legend,
  type TooltipItem,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

// Register all chart types used in this page
ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  ArcElement, Filler, Tooltip, Legend
)

// ─── Data ─────────────────────────────────────────────────────────────────────

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

const trafficData = {
  labels: months,
  datasets: [
    {
      label: 'Organic',
      data: [4200, 4800, 5100, 5600, 6200, 6800],
      backgroundColor: 'rgba(59,130,246,0.85)',
      borderRadius: 6,
    },
    {
      label: 'Paid',
      data: [1800, 2100, 1900, 2300, 2600, 2900],
      backgroundColor: 'rgba(139,92,246,0.85)',
      borderRadius: 6,
    },
    {
      label: 'Referral',
      data: [900, 1100, 1000, 1200, 1400, 1600],
      backgroundColor: 'rgba(16,185,129,0.85)',
      borderRadius: 6,
    },
  ],
}

const conversionData = {
  labels: months,
  datasets: [
    {
      label: 'Conversion rate %',
      data: [2.1, 2.4, 2.2, 2.8, 3.1, 3.4],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: '#10b981',
    },
  ],
}

const channelData = {
  labels: ['Organic Search', 'Direct', 'Paid Ads', 'Social', 'Referral', 'Email'],
  datasets: [
    {
      data: [38, 22, 16, 12, 8, 4],
      backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6b7280'],
      borderWidth: 0,
      hoverOffset: 6,
    },
  ],
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 10, font: { size: 11 }, color: '#64748b' } },
  },
  scales: {
    x: { stacked: false, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
  },
}

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y ?? 0}%`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: { color: '#94a3b8', font: { size: 11 }, callback: (v: string | number) => `${v}%` },
    },
  },
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'right' as const,
      labels: { boxWidth: 10, font: { size: 11 }, color: '#64748b', padding: 12 },
    },
  },
}

const summaryStats = [
  { label: 'Total Sessions', value: '38,421', change: '+18.2%', up: true },
  { label: 'Avg. Session Duration', value: '4m 32s', change: '+23s', up: true },
  { label: 'Bounce Rate', value: '38.4%', change: '-2.1%', up: true },
]

export default function Analytics() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Traffic, conversion and channel data — Jan–Jun 2025</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {summaryStats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className="text-xl font-semibold text-slate-800 mt-1">{s.value}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {s.change}
            </p>
          </div>
        ))}
      </div>

      {/* Traffic bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Traffic by source</h3>
        <div style={{ height: 280 }}>
          <Bar data={trafficData} options={barOptions} />
        </div>
      </div>

      {/* Two charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion rate line chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-slate-800">Conversion rate</h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
              +1.3pp
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">6-month trend</p>
          <div style={{ height: 220 }}>
            <Line data={conversionData} options={lineOptions} />
          </div>
        </div>

        {/* Channel doughnut */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Traffic channels</h3>
          <p className="text-xs text-slate-500 mb-4">Session share by acquisition channel</p>
          <div style={{ height: 220 }}>
            <Doughnut data={channelData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
