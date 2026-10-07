import { useEffect, useState } from 'react'
import type { PlanRequest } from '../algorithms/packing.worker'
import type { Project } from '../lib/project'
import type { CargoItem, OptimizationResult, StrategySummary, Truck } from '../types'

type WorkerReply = { result?: OptimizationResult; comparison?: StrategySummary[]; error?: string }

/** Run one request in a fresh worker after a short pause, so rapid edits start only one calculation. */
function runInWorker(request: PlanRequest, onReply: (reply: WorkerReply) => void, startError: string): () => void {
  let worker: Worker | undefined
  const timer = window.setTimeout(() => {
    try {
      worker = new Worker(new URL('../algorithms/packing.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = event => { onReply(event.data); worker?.terminate() }
      worker.onerror = () => { onReply({ error: 'Calculation failed. Try Optimize again.' }); worker?.terminate() }
      worker.postMessage(request)
    } catch { onReply({ error: startError }) }
  }, 300)
  return () => { window.clearTimeout(timer); worker?.terminate() }
}

/** The loading plan for a project, recalculated in the background whenever its inputs change. */
export function usePlan(project: Project, valid: boolean) {
  const { truck, cargo, optimizationMode } = project
  const signature = JSON.stringify({ truck, cargo, optimizationMode })
  const [calculation, setCalculation] = useState<{ signature: string; result: OptimizationResult }>()
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setError('')
    if (!valid) return
    return runInWorker({ truck, cargo, optimizationMode }, reply => {
      if (reply.result) setCalculation({ signature, result: reply.result })
      else setError(reply.error ?? 'Calculation failed. Try Optimize again.')
    }, 'Could not start the loading calculation. Try reloading this page.')
  }, [signature, revision, valid])

  const result = calculation?.signature === signature ? calculation.result : undefined
  return {
    signature, result, error,
    busy: valid && !result && !error,
    retry: () => setRevision(value => value + 1),
    recalculate: () => { setCalculation(undefined); setRevision(value => value + 1) },
  }
}

/** Results of every strategy for the same shipment, calculated while `enabled`. */
export function useComparison(truck: Truck, cargo: CargoItem[], enabled: boolean) {
  const signature = JSON.stringify({ truck, cargo })
  const [comparison, setComparison] = useState<{ signature: string; rows: StrategySummary[] }>()
  const [error, setError] = useState('')
  const ready = comparison?.signature === signature

  useEffect(() => {
    setError('')
    if (!enabled || ready) return
    return runInWorker({ truck, cargo, optimizationMode: 'compact-stack', compare: true }, reply => {
      if (reply.comparison) setComparison({ signature, rows: reply.comparison })
      else setError(reply.error ?? 'Comparison failed.')
    }, 'Could not start the comparison.')
  }, [signature, enabled, ready])

  return { rows: ready ? comparison.rows : undefined, error }
}
