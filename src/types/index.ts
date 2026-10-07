export type Priority = 'High' | 'Medium' | 'Low'
export type OptimizationMode = 'maximize-items' | 'weight-aware' | 'space-only' | 'compact-stack'
export type Vec3 = { x: number; y: number; z: number }

/** Axle positions are measured along the vehicle length from the front of the cargo space
 * (negative = ahead of it). Limits are the cargo load each axle may carry, in kg. */
export interface Axles { front: number; rear: number; frontLimit: number; rearLimit: number }
export interface Truck { name: string; length: number; width: number; height: number; maxWeight: number; axles?: Axles }

export interface CargoItem {
  id: string; name: string
  length: number; width: number; height: number; weight: number
  maxStackWeight: number; quantity: number; priority: Priority; color: string
  rotate: boolean; stackable: boolean
  /** Delivery stop: 1 is unloaded first, so it is loaded nearest the rear door. */
  stop: number
}

export interface PackedBox {
  id: string; cargoId: string; name: string
  dimensions: [number, number, number]; weight: number; maxStackWeight: number; color: string
  position: Vec3; priority: Priority; stop: number; level: number; stackable: boolean
  supportedBy: string[]; loadAbove: number; totalLoad: number; gravitationalForce: number
}

export interface LoadBalance { front: number; rear: number; left: number; right: number; variance: number }
export interface AxleLoad { front: number; rear: number; frontLimit: number; rearLimit: number }
export interface OptimizationMetrics {
  volume: number; totalWeight: number; spaceUtil: number; weightUtil: number; score: number
  loaded: number; total: number; cog: Vec3; balance: LoadBalance; axle?: AxleLoad
}
export interface OptimizationResult { boxes: PackedBox[]; unloaded: string[]; metrics: OptimizationMetrics }
export interface StrategySummary { mode: OptimizationMode; metrics: OptimizationMetrics }
