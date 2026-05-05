// src/types/index.ts
// Shared domain types used across pages and widgets

export interface KPIMetric {
  id: string
  label: string
  value: string
  change: number        // percentage, positive = up
  trend: 'up' | 'down'
  icon: React.ReactNode
  color: string         // Tailwind bg class for icon container
}

export interface Transaction {
  id: string
  date: string
  customer: string
  email: string
  amount: number
  status: 'completed' | 'pending' | 'failed'
  country: string
  product: string
}

export interface ActivityItem {
  id: string
  user: string
  initials: string
  action: string
  target: string
  time: string
  type: 'signup' | 'purchase' | 'upgrade' | 'cancellation' | 'comment'
}

export interface ChartDataPoint {
  label: string
  value: number
}
