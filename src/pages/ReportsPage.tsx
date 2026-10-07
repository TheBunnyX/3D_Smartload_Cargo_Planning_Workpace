import { Download } from 'lucide-react'
import { Stat } from '../components/Field'
import { PlanDiagram } from '../components/PlanDiagram'
import { useComparison } from '../hooks/usePlan'
import { download, fmt, modeNames } from '../lib/format'
import { csvCell } from '../lib/project'
import type { Project } from '../lib/project'
import type { CargoItem, OptimizationMode, OptimizationResult, Truck } from '../types'

function unplacedReason(item: CargoItem, truck: Truck, result: OptimizationResult, enforcePayload: boolean, multiStop: boolean) {
  const fits = item.height <= truck.height && ((item.length <= truck.length && item.width <= truck.width) || (item.rotate && item.width <= truck.length && item.length <= truck.width))
  if (!fits) return 'Exceeds vehicle dimensions'
  if (enforcePayload && item.weight + result.metrics.totalWeight > truck.maxWeight) return 'Insufficient remaining payload'
  return 'No feasible placement found: space, support' + (multiStop ? ', door access' : '') + ' or stacking limit'
}

export function ReportsPage({ project, result, busy, onUseMode, onEditCargo }: {
  project: Project; result?: OptimizationResult; busy: boolean
  onUseMode: (mode: OptimizationMode) => void; onEditCargo: (id: string) => void
}) {
  const { name, truck, cargo, optimizationMode } = project
  const comparison = useComparison(truck, cargo, !!result)
  const multiStop = new Set(cargo.map(item => item.stop)).size > 1
  const boxCount = result?.boxes.length ?? 0

  const exportManifest = () => {
    if (!result) return
    const rows = result.boxes.map((b, i) => [i + 1, b.id, b.name, b.stop, b.weight, b.position.x, b.position.y, b.position.z, b.level, b.loadAbove, b.supportedBy.join(';')].map(csvCell).join(','))
    download('3dsmartload-manifest.csv', '﻿sequence,id,name,stop,weight_kg,x_m,y_m,z_m,level,load_above_kg,supported_by\r\n' + rows.join('\r\n'), 'text/csv;charset=utf-8')
  }

  return <section className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">DISPATCH REPORT</span>
        <h1>A clearer plan for the road.</h1>
        <p>{name} · {truck.name}</p>
      </div>
      <div className="header-actions">
        <button className="btn" disabled={!result} onClick={exportManifest}><Download size={15}/>Manifest CSV</button>
        <button className="btn primary" disabled={!result} onClick={() => window.print()}>Print report</button>
      </div>
    </div>

    {!result && <div className="panel empty-state">
      <h3>{busy ? 'Preparing your report…' : 'A valid plan is needed'}</h3>
      <p>Reports will appear after the loading calculation completes.</p>
    </div>}

    {result && <>
      <div className="report-stats">
        <Stat label="Placed units" value={result.metrics.loaded + ' / ' + result.metrics.total}/>
        <Stat label="Loaded weight" value={fmt(result.metrics.totalWeight) + ' kg'}/>
        <Stat label="Occupied volume" value={fmt(result.metrics.volume) + ' m³'}/>
        <Stat label="Unplaced units" value={String(result.unloaded.length)}/>
      </div>

      {result.unloaded.length > 0 && <div className="panel exceptions">
        <h3>Items needing another plan</h3>
        <p>These units could not be placed by the current strategy. Try a larger vehicle, another strategy, or adjust quantities and stacking limits.</p>
        {cargo.map(item => {
          const missing = item.quantity - result.boxes.filter(box => box.cargoId === item.id).length
          if (!missing) return null
          return <div className="exception-row" key={item.id}>
            <b>{item.name}</b>
            <span>{missing} unplaced</span>
            <small>{unplacedReason(item, truck, result, optimizationMode !== 'space-only', multiStop)}</small>
            <button className="btn small" onClick={() => onEditCargo(item.id)}>Edit cargo</button>
          </div>
        })}
      </div>}

      <div className="panel table-panel report-section">
        <div className="panel-heading">
          <div><span className="eyebrow">STRATEGIES</span><h2>Strategy comparison</h2></div>
          {!comparison.rows && !comparison.error && <span className="pill">Comparing…</span>}
        </div>
        {comparison.error && <p className="inline-error panel-note">{comparison.error}</p>}
        <div className="table-scroll">
          <table>
            <thead><tr><th>Strategy</th><th>Placed</th><th>Space</th><th>Payload</th><th>Left / right</th>{truck.axles && <th>Axles</th>}<th>Score</th><th></th></tr></thead>
            <tbody>
              {(Object.keys(modeNames) as OptimizationMode[]).map(mode => {
                const metrics = comparison.rows?.find(row => row.mode === mode)?.metrics
                const axleOver = metrics?.axle && (metrics.axle.front > metrics.axle.frontLimit || metrics.axle.rear > metrics.axle.rearLimit || metrics.axle.front < 0)
                return <tr key={mode} className={mode === optimizationMode ? 'row-selected' : ''}>
                  <td><b>{modeNames[mode]}</b></td>
                  <td>{metrics ? metrics.loaded + ' / ' + metrics.total : '—'}</td>
                  <td>{metrics ? fmt(metrics.spaceUtil) + '%' : '—'}</td>
                  <td className={metrics && metrics.weightUtil > 100 ? 'over' : ''}>{metrics ? fmt(metrics.weightUtil) + '%' : '—'}</td>
                  <td>{metrics ? fmt(metrics.balance.left, 0) + '% / ' + fmt(metrics.balance.right, 0) + '%' : '—'}</td>
                  {truck.axles && <td className={axleOver ? 'over' : ''}>{!metrics ? '—' : axleOver ? 'Over limit' : 'Within limits'}</td>}
                  <td><b>{metrics ? metrics.score : '—'}</b></td>
                  <td>{mode === optimizationMode
                    ? <span className="pill success">Current</span>
                    : <button className="btn small" onClick={() => onUseMode(mode)}>Use</button>}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </div>

      {boxCount > 0 && <div className="panel report-section">
        <div className="panel-heading diagram-heading">
          <div><span className="eyebrow">LAYOUT</span><h2>Loading plan</h2></div>
          <span className="pill">Numbers match the manifest</span>
        </div>
        <div className="diagram-grid">
          <PlanDiagram truck={truck} boxes={result.boxes} view="top"/>
          <PlanDiagram truck={truck} boxes={result.boxes} view="side"/>
        </div>
      </div>}

      <div className="panel table-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">PLACEMENT ORDER</span><h2>Loading manifest</h2></div>
          <span className="pill">{modeNames[optimizationMode]}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>#</th><th>Unit / cargo</th><th>Stop</th><th>Mass</th><th>Center position (x, y, z)</th><th>Level</th><th>Load above / limit</th></tr></thead>
            <tbody>
              {result.boxes.map((box, i) => <tr key={box.id}>
                <td>{i + 1}</td>
                <td><b>{box.name}</b><small>{box.id}</small></td>
                <td>{box.stop}</td>
                <td>{fmt(box.weight)} kg</td>
                <td>{[box.position.x, box.position.y, box.position.z].map(n => fmt(n, 2)).join(', ')} m</td>
                <td>{box.level}</td>
                <td>{fmt(box.loadAbove)} / {fmt(box.maxStackWeight)} kg</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!boxCount && <div className="empty-state">No cargo has been placed.</div>}
      </div>
      <p className="report-note">
        Placement order shows how the plan was constructed{multiStop && '; later delivery stops are loaded first and nothing for a later stop stands between earlier-stop cargo and the rear door'}.
        Check physical loading access, securing and axle limits before dispatch. This is a static planning model with uniformly distributed box mass.
      </p>
    </>}
  </section>
}
