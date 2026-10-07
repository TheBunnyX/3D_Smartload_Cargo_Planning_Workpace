import type { OptimizationMode, Truck } from '../types'
import { demoTruck } from '../data/demo'

export const fmt = (n: number, digits = 1) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'
export const fmtDate = (time: number) => new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function download(name: string, contents: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const presets: Truck[] = [
  { name: 'Pickup', length: 2.4, width: 1.5, height: 1.2, maxWeight: 1000 },
  { name: '4-Wheel Truck', length: 4.2, width: 2, height: 2, maxWeight: 4000 },
  demoTruck,
  { name: '10-Wheel Truck', length: 7.5, width: 2.4, height: 2.5, maxWeight: 12000 },
  { name: 'Container 20ft', length: 5.9, width: 2.35, height: 2.39, maxWeight: 21700 },
  { name: 'Container 40ft', length: 12.03, width: 2.35, height: 2.39, maxWeight: 26700 },
]

export const modeNames: Record<OptimizationMode, string> = {
  'compact-stack': 'Compact stacking',
  'maximize-items': 'Maximize loaded items',
  'weight-aware': 'Floor-first loading',
  'space-only': 'Space only · ignores payload',
}
export const modeHelp: Record<OptimizationMode, string> = {
  'compact-stack': 'Stacks cargo to keep the occupied floor area compact.',
  'maximize-items': 'Tries several loading orders and keeps the one that places the most units.',
  'weight-aware': 'Fills the floor first, then stacks supported cargo.',
  'space-only': 'Checks space and stacking; payload is not enforced.',
}
