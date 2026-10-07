import { compareStrategies, optimize } from './packing'
import type { Project } from '../lib/project'

export type PlanRequest = Pick<Project, 'truck' | 'cargo' | 'optimizationMode'> & { compare?: boolean }

self.onmessage = (event: MessageEvent<PlanRequest>) => {
  try {
    const { truck, cargo, optimizationMode, compare } = event.data
    if (compare) self.postMessage({ comparison: compareStrategies(truck, cargo) })
    else self.postMessage({ result: optimize(truck, cargo, { mode: optimizationMode }) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Optimization failed.' })
  }
}
