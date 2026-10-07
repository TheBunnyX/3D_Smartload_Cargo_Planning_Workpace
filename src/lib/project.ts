import type { Axles, CargoItem, OptimizationMode, Truck } from '../types'

export const MAX_UNITS = 150
export const MAX_STOPS = 20
export const modes: OptimizationMode[] = ['compact-stack', 'maximize-items', 'weight-aware', 'space-only']
export const cargoColors = ['#5479df', '#d98b53', '#8c70c6', '#349988']
export interface Project { name: string; truck: Truck; cargo: CargoItem[]; optimizationMode: OptimizationMode }

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const positive = (value: unknown) => finite(value) && (value as number) > 0
const nonnegative = (value: unknown) => finite(value) && (value as number) >= 0
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0

export function nextId(items: { id: string }[]): string {
  let i = 1
  while (items.some(item => item.id === 'BX-' + String(i).padStart(3, '0'))) i++
  return 'BX-' + String(i).padStart(3, '0')
}

/** Starting estimate for a vehicle with no axle data; users replace it with real figures. */
export function defaultAxles(truck: Truck): Axles {
  const round = (value: number) => Math.round(value * 100) / 100
  return { front: -1, rear: round(truck.length * 0.75), frontLimit: Math.round(truck.maxWeight * 0.35), rearLimit: Math.round(truck.maxWeight * 0.8) }
}

export function validateCargoItem(item: CargoItem): string[] {
  const errors: string[] = []
  const label = item.name || item.id || 'Cargo'
  if (!text(item.name)) errors.push(`${label}: enter a name.`)
  if (![item.length, item.width, item.height, item.weight].every(positive)) errors.push(`${label}: dimensions and weight must be positive, finite numbers.`)
  if (!nonnegative(item.maxStackWeight)) errors.push(`${label}: maximum load above must be zero or greater.`)
  if (!Number.isInteger(item.quantity) || item.quantity < 0) errors.push(`${label}: quantity must be a whole number, zero or greater.`)
  if (!['High', 'Medium', 'Low'].includes(item.priority)) errors.push(`${label}: invalid priority.`)
  if (typeof item.rotate !== 'boolean' || typeof item.stackable !== 'boolean') errors.push(`${label}: invalid stacking or rotation setting.`)
  if (typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)) errors.push(`${label}: choose a valid color.`)
  if (!Number.isInteger(item.stop) || item.stop < 1 || item.stop > MAX_STOPS) errors.push(`${label}: delivery stop must be a whole number from 1 to ${MAX_STOPS}.`)
  return errors
}

export function validateInputs(truck: Truck, cargo: CargoItem[]): string[] {
  const errors: string[] = []
  if (!text(truck.name)) errors.push('Enter a vehicle name.')
  if (![truck.length, truck.width, truck.height, truck.maxWeight].every(positive)) errors.push('Vehicle dimensions and payload must be positive, finite numbers.')
  if (truck.axles !== undefined) {
    const axles = truck.axles
    if (!axles || typeof axles !== 'object' || ![axles.front, axles.rear].every(finite) || axles.rear <= axles.front) errors.push('Axle positions must be numbers, with the rear axle behind the front axle.')
    else if (![axles.frontLimit, axles.rearLimit].every(positive)) errors.push('Axle load limits must be positive, finite numbers.')
  }
  const ids = new Set<string>()
  for (const item of cargo) {
    if (!text(item.id) || ids.has(item.id)) errors.push(`${item.name || item.id || 'Cargo'}: cargo IDs must be unique.`)
    ids.add(item.id)
    errors.push(...validateCargoItem(item))
  }
  if (cargo.length > MAX_UNITS || cargo.reduce((sum, item) => sum + item.quantity, 0) > MAX_UNITS) errors.push(`Use up to ${MAX_UNITS} units per plan. Split larger shipments into separate projects.`)
  return errors
}

/** Validate untrusted project data and keep only the fields the app understands. */
export function normalizeProject(value: any): Project {
  if (!value || typeof value !== 'object' || !value.truck || typeof value.truck !== 'object' || !Array.isArray(value.cargo)) throw new Error('Choose a 3DSmartLoad project JSON file.')
  if (value.cargo.some((item: unknown) => !item || typeof item !== 'object')) throw new Error('Invalid cargo data.')
  const cargo: CargoItem[] = value.cargo.map((item: CargoItem & { fragile?: boolean }) => ({
    id: item.id, name: item.name,
    length: item.length, width: item.width, height: item.height, weight: item.weight,
    // Projects saved before stacking limits existed marked delicate cargo as "fragile".
    maxStackWeight: item.fragile ? 0 : item.maxStackWeight ?? item.weight * 2,
    quantity: item.quantity, priority: item.priority, color: item.color,
    rotate: item.rotate, stackable: item.fragile ? false : item.stackable,
    stop: item.stop ?? 1,
  }))
  const source = value.truck
  const truck: Truck = { name: source.name, length: source.length, width: source.width, height: source.height, maxWeight: source.maxWeight }
  if (source.axles !== undefined && source.axles !== null) {
    const axles = source.axles
    truck.axles = typeof axles === 'object' ? { front: axles.front, rear: axles.rear, frontLimit: axles.frontLimit, rearLimit: axles.rearLimit } : axles
  }
  const errors = validateInputs(truck, cargo)
  const optimizationMode = value.optimizationMode ?? (value.useWeightLimit === false ? 'space-only' : 'compact-stack')
  if (!modes.includes(optimizationMode)) errors.push('Unknown optimization mode.')
  if (errors.length) throw new Error(errors[0])
  const name = value.name ?? value.project ?? 'Imported project'
  if (!text(name)) throw new Error('Project name must be text.')
  return { name, truck, cargo, optimizationMode }
}

export function parseProject(raw: string): Project {
  return normalizeProject(JSON.parse(raw))
}

export function csvCell(value: string | number | boolean): string {
  const raw = String(value)
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export const cargoCsvKeys: (keyof CargoItem)[] = ['id', 'name', 'length', 'width', 'height', 'weight', 'quantity', 'priority', 'maxStackWeight', 'stackable', 'rotate', 'color', 'stop']

export function cargoCsv(cargo: CargoItem[]): string {
  return '﻿' + [cargoCsvKeys.join(','), ...cargo.map(item => cargoCsvKeys.map(key => csvCell(item[key])).join(','))].join('\r\n')
}
