/**
 * src/pages/Settings.tsx
 *
 * Lightweight route — no heavy dependencies.
 * Even though settings is rarely visited (good lazy candidate),
 * it's small enough that the network round-trip cost is the only expense.
 *
 * Tip: lazy-load settings anyway — a typical settings page imports
 * form libraries, date pickers, or file upload components that add up.
 */

import { useState } from 'react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="w-72 flex-shrink-0">{children}</div>
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'

export default function Settings() {
  const [notifications, setNotifications] = useState({
    email: true,
    billing: true,
    product: false,
  })

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences</p>
        </div>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <Field label="Full name" hint="Your display name across the platform">
          <input type="text" defaultValue="Bruce Sandstone" className={inputClass} />
        </Field>
        <Field label="Email" hint="Used for login and notifications">
          <input type="email" defaultValue="bruce@lumina.io" className={inputClass} />
        </Field>
        <Field label="Role">
          <select className={inputClass}>
            <option>Administrator</option>
            <option>Editor</option>
            <option>Viewer</option>
          </select>
        </Field>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        {(Object.keys(notifications) as Array<keyof typeof notifications>).map((key) => (
          <Field
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1) + ' notifications'}
            hint={
              key === 'email' ? 'Weekly digest and product updates' :
              key === 'billing' ? 'Invoice and payment alerts' :
              'New features and announcements'
            }
          >
            <button
              onClick={() => setNotifications((n) => ({ ...n, [key]: !n[key] }))}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                notifications[key] ? 'bg-blue-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                  notifications[key] ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </Field>
        ))}
      </Section>

      {/* API */}
      <Section title="API Access">
        <Field label="API Key" hint="Use this key to authenticate API requests">
          <div className="flex gap-2">
            <input
              type="password"
              defaultValue="sk-lumina-prod-4f8a92b1c3d7e6f0"
              className={`${inputClass} flex-1 font-mono text-xs`}
              readOnly
            />
            <button className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
              Copy
            </button>
          </div>
        </Field>
        <Field label="Rotate key" hint="Generates a new key and invalidates the current one">
          <button className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
            Rotate API key
          </button>
        </Field>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <Field label="Delete account" hint="Permanently removes all data. This cannot be undone.">
          <button className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete account
          </button>
        </Field>
      </Section>
    </div>
  )
}
