/**
 * src/widgets/ActivityFeed.tsx
 *
 * Component-level lazy split — another separate chunk from Dashboard.
 *
 * This widget is below the fold: the user must scroll to see it.
 * Lazily loading it lets the above-fold content (KPIs + RevenueChart)
 * finish rendering before we even request this chunk.
 *
 * In production, you'd enhance this with IntersectionObserver to only
 * trigger the import once the user scrolls the feed into view.
 */

import type { ActivityItem } from '../types'

const feed: ActivityItem[] = [
  { id: '1', user: 'Sarah Chen',     initials: 'SC', action: 'upgraded to',  target: 'Pro plan',        time: '2m ago',  type: 'upgrade' },
  { id: '2', user: 'Marcus Webb',    initials: 'MW', action: 'purchased',    target: 'Enterprise seats', time: '14m ago', type: 'purchase' },
  { id: '3', user: 'Priya Sharma',   initials: 'PS', action: 'signed up for', target: 'free trial',      time: '38m ago', type: 'signup' },
  { id: '4', user: 'Tom O\'Brien',   initials: 'TO', action: 'cancelled',    target: 'Starter plan',    time: '1h ago',  type: 'cancellation' },
  { id: '5', user: 'Leila Hassan',   initials: 'LH', action: 'upgraded to',  target: 'Business plan',   time: '2h ago',  type: 'upgrade' },
  { id: '6', user: 'James Park',     initials: 'JP', action: 'purchased',    target: 'add-on storage',  time: '3h ago',  type: 'purchase' },
  { id: '7', user: 'Diana Vasquez',  initials: 'DV', action: 'signed up for', target: 'free trial',     time: '5h ago',  type: 'signup' },
]

const typeColors: Record<ActivityItem['type'], string> = {
  signup:       'bg-blue-100 text-blue-700',
  purchase:     'bg-emerald-100 text-emerald-700',
  upgrade:      'bg-violet-100 text-violet-700',
  cancellation: 'bg-rose-100 text-rose-700',
  comment:      'bg-slate-100 text-slate-700',
}

export default function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Recent activity</h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all</button>
      </div>

      <div className="space-y-3">
        {feed.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${typeColors[item.type]}`}>
              {item.initials}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 truncate">
                <span className="font-medium">{item.user}</span>
                {' '}{item.action}{' '}
                <span className="font-medium">{item.target}</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{item.time}</p>
            </div>

            {/* Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeColors[item.type]}`}>
              {item.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
