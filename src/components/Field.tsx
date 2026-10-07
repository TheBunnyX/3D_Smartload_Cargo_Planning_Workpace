import { useState } from 'react'
import { fmt } from '../lib/format'

export function Field({ label, value, unit, onChange, min = 0, step = 'any' }: {
  label: string; value: string | number; unit?: string; onChange: (value: string) => void; min?: number; step?: string
}) {
  // Show what was typed in a number field while it still matches the value, so clearing it does not snap back to 0.
  const [draft, setDraft] = useState<string>()
  const numeric = typeof value === 'number'
  return <label className="field">
    <span>{label}</span>
    <div className="input-unit">
      <input
        type={numeric ? 'number' : 'text'} min={min} step={step}
        value={numeric && draft !== undefined && Number(draft) === value ? draft : value}
        onChange={event => { if (numeric) setDraft(event.target.value); onChange(event.target.value) }}
        onBlur={() => setDraft(undefined)}
      />
      {unit && <em>{unit}</em>}
    </div>
  </label>
}

export function Metric({ label, value, description, color }: { label: string; value?: number; description: string; color: string }) {
  return <div className="metric">
    <div><span>{label}</span><b>{value === undefined ? '—' : fmt(value) + '%'}</b></div>
    <div className="progress"><i style={{ width: Math.min(100, Math.max(0, value ?? 0)) + '%', background: color }}/></div>
    <small>{description}</small>
  </div>
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <div className="panel stat"><span>{label}</span><strong>{value}</strong></div>
}
