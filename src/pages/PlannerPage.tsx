import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRight, Box, Layers3, Maximize2, Pause, Play, Plus, RotateCcw, Scale, ScanLine, Sparkles, Truck, X } from 'lucide-react'
import { Field, Metric } from '../components/Field'
import { fmt, modeHelp, modeNames, presets } from '../lib/format'
import { defaultAxles, MAX_UNITS } from '../lib/project'
import type { Project } from '../lib/project'
import type { Axles, OptimizationMode, OptimizationResult, Truck as TruckType } from '../types'

const CargoScene = lazy(() => import('../components/CargoScene'))

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="empty-state">
      <Box size={36}/>
      <h3>3D view unavailable</h3>
      <p>Your browser could not initialize the 3D scene. The loading manifest and reports are still available.</p>
    </div>
  }
}

export function PlannerPage({ project, setProject, valid, result, busy, onOptimize, onAddCargo, onEditCargo, onOpenReports, notify }: {
  project: Project; setProject: (update: (current: Project) => Project) => void
  valid: boolean; result?: OptimizationResult; busy: boolean
  onOptimize: () => void; onAddCargo: () => void; onEditCargo: (id: string) => void; onOpenReports: () => void
  notify: (message: string) => void
}) {
  const { truck, cargo, optimizationMode } = project
  const [selected, setSelected] = useState<string>()
  const [wire, setWire] = useState(false)
  const [showMass, setShowMass] = useState(false)
  const [view, setView] = useState('Perspective')
  const [cameraReset, setCameraReset] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState<number | null>(null)
  const canvasWrap = useRef<HTMLDivElement>(null)

  const boxCount = result?.boxes.length ?? 0
  const visible = Math.min(step ?? boxCount, boxCount)
  const selectedBox = result?.boxes.find(box => box.id === selected)
  const totalUnits = cargo.reduce((sum, item) => sum + item.quantity, 0)
  const multiStop = new Set(cargo.map(item => item.stop)).size > 1
  const volume = truck.length * truck.width * truck.height
  const presetIndex = presets.findIndex(p => p.name === truck.name && p.length === truck.length && p.width === truck.width && p.height === truck.height && p.maxWeight === truck.maxWeight)
  const axle = result?.metrics.axle

  // A new plan starts from the full load with nothing selected.
  useEffect(() => { setPlaying(false); setStep(null); setSelected(undefined) }, [result])
  useEffect(() => {
    if (!playing || !result) return
    const timer = window.setInterval(() => setStep(current => {
      const next = (current ?? 0) + 1
      if (next >= boxCount) { setPlaying(false); return boxCount }
      return next
    }), 450)
    return () => window.clearInterval(timer)
  }, [playing, result, boxCount])

  const updateTruck = (key: keyof Omit<TruckType, 'axles'>, value: string) => setProject(current => ({ ...current, truck: { ...current.truck, [key]: key === 'name' ? value : Number(value) } }))
  const updateAxle = (key: keyof Axles, value: string) => setProject(current => ({ ...current, truck: { ...current.truck, axles: { ...(current.truck.axles ?? defaultAxles(current.truck)), [key]: Number(value) } } }))
  const toggleAxles = (enabled: boolean) => setProject(current => {
    const { axles, ...rest } = current.truck
    return { ...current, truck: enabled ? { ...rest, axles: axles ?? defaultAxles(current.truck) } : rest }
  })
  const choosePreset = (value: string) => {
    if (value === 'custom') updateTruck('name', 'Custom vehicle')
    else setProject(current => ({ ...current, truck: { ...presets[Number(value)] } }))
  }
  const togglePlay = () => {
    if (playing) { setPlaying(false); return }
    if (step === null || step >= boxCount) setStep(0)
    setPlaying(true)
  }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (canvasWrap.current?.requestFullscreen) await canvasWrap.current.requestFullscreen()
      else notify('Fullscreen is not supported in this browser.')
    } catch { notify('Fullscreen could not be opened in this browser.') }
  }

  return <div className="planner-grid">
    <aside className="panel setup">
      <div className="panel-heading">
        <div><span className="eyebrow">01 / CONFIGURE</span><h2>Make room for more.</h2></div>
        <Truck size={23}/>
      </div>
      <label className="field">
        <span>Vehicle preset</span>
        <select value={presetIndex < 0 ? 'custom' : String(presetIndex)} onChange={event => choosePreset(event.target.value)}>
          <option value="custom">Custom vehicle</option>
          {presets.map((preset, i) => <option key={preset.name} value={i}>{preset.name}</option>)}
        </select>
      </label>
      <div className="field-grid">
        <Field label="Vehicle name" value={truck.name} onChange={v => updateTruck('name', v)}/>
        <Field label="Payload" value={truck.maxWeight} unit="kg" onChange={v => updateTruck('maxWeight', v)}/>
        <Field label="Length" value={truck.length} unit="m" onChange={v => updateTruck('length', v)}/>
        <Field label="Width" value={truck.width} unit="m" onChange={v => updateTruck('width', v)}/>
        <Field label="Height" value={truck.height} unit="m" onChange={v => updateTruck('height', v)}/>
        <div className="capacity"><span>Available volume</span><strong>{fmt(volume)} <small>m³</small></strong></div>
      </div>
      <label className="checkbox axle-toggle">
        <input type="checkbox" checked={!!truck.axles} onChange={event => toggleAxles(event.target.checked)}/>
        <span>Check axle loads<small>Positions are measured from the front of the cargo space; use a negative value for an axle ahead of it.</small></span>
      </label>
      {truck.axles && <div className="field-grid">
        <Field label="Front axle at" value={truck.axles.front} unit="m" min={-50} onChange={v => updateAxle('front', v)}/>
        <Field label="Rear axle at" value={truck.axles.rear} unit="m" min={-50} onChange={v => updateAxle('rear', v)}/>
        <Field label="Front cargo limit" value={truck.axles.frontLimit} unit="kg" onChange={v => updateAxle('frontLimit', v)}/>
        <Field label="Rear cargo limit" value={truck.axles.rearLimit} unit="kg" onChange={v => updateAxle('rearLimit', v)}/>
      </div>}
      <label className="field mode-field">
        <span>Loading strategy</span>
        <select value={optimizationMode} onChange={event => setProject(current => ({ ...current, optimizationMode: event.target.value as OptimizationMode }))}>
          {Object.entries(modeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="helper">{modeHelp[optimizationMode]}</p>
      <div className="section-heading">
        <h3>Cargo collection <span>{cargo.length}</span></h3>
        <button className="icon-btn" aria-label="Add cargo" onClick={onAddCargo}><Plus size={17}/></button>
      </div>
      <div className="cargo-list">
        {cargo.map(item => <button className="cargo-row" key={item.id} onClick={() => onEditCargo(item.id)}>
          <span className="swatch" style={{ background: item.color }}/>
          <span>
            <b>{item.name}</b>
            <small>{fmt(item.length)} × {fmt(item.width)} × {fmt(item.height)} m · {fmt(item.weight)} kg{multiStop && ' · Stop ' + item.stop}</small>
          </span>
          <strong>×{item.quantity}</strong>
          <ArrowUpRight size={14}/>
        </button>)}
        {!cargo.length && <p className="helper">Your cargo collection is empty. Add your first item to start a plan.</p>}
      </div>
      <button className="btn add-btn" onClick={onAddCargo}><Plus size={16}/>Add cargo</button>
      <p className="helper">{totalUnits} / {MAX_UNITS} units · Changes recalculate automatically.</p>
    </aside>

    <section className="scene-panel panel">
      <div className="scene-heading">
        <div><span className="eyebrow">02 / EXPLORE</span><h2>Every box in its place.</h2></div>
        <span className={'pill ' + (result ? 'success' : '')}>{busy ? 'Calculating…' : result ? 'Plan ready' : 'Needs attention'}</span>
      </div>
      <div className="scene-toolbar">
        <div className="view-tabs">
          {['Perspective', 'Top', 'Front', 'Side'].map(value => <button className={view === value ? 'active' : ''} key={value} onClick={() => setView(value)}>{value}</button>)}
        </div>
        <div className="tool-buttons">
          <button title="Wireframe" aria-label="Toggle wireframe" aria-pressed={wire} className={'icon-btn ' + (wire ? 'active' : '')} onClick={() => setWire(v => !v)}><ScanLine size={17}/></button>
          <button title="Mass labels" aria-label="Toggle mass labels" aria-pressed={showMass} className={'icon-btn ' + (showMass ? 'active' : '')} onClick={() => setShowMass(v => !v)}><Scale size={17}/></button>
          <button className="icon-btn" title="Reset camera" aria-label="Reset camera" onClick={() => setCameraReset(v => v + 1)}><RotateCcw size={17}/></button>
          <button className="icon-btn" title="Fullscreen" aria-label="Fullscreen" onClick={() => void fullscreen()}><Maximize2 size={17}/></button>
        </div>
      </div>
      <div className="canvaswrap" ref={canvasWrap}>
        {result
          ? <SceneBoundary>
              <Suspense fallback={<div className="empty-state">Loading 3D workspace…</div>}>
                <CargoScene key={cameraReset} truck={truck} boxes={result.boxes.slice(0, visible)} selected={selected} onSelect={setSelected} wire={wire} showMass={showMass} view={view} cog={result.metrics.cog} showCog={visible === boxCount && boxCount > 0}/>
              </Suspense>
            </SceneBoundary>
          : <div className="empty-state">
              <Layers3 size={40}/>
              <h3>{busy ? 'Finding space for your cargo…' : 'Ready when you are'}</h3>
              <p>{busy ? 'You can keep editing while the plan calculates.' : 'Resolve the input errors to see your loading plan.'}</p>
            </div>}
        <div className="scene-legend">
          <span><i style={{ background: '#5479df' }}/>Loaded cargo</span>
          <span><i style={{ background: '#ed7a4a' }}/>Center of gravity</span>
        </div>
      </div>
      <div className="sequence">
        <button className="play-btn" aria-label={playing ? 'Pause loading sequence' : 'Play loading sequence'} disabled={!boxCount} onClick={togglePlay}>
          {playing ? <Pause size={19}/> : <Play size={19}/>}
        </button>
        <div><strong>Placement sequence</strong><small>{visible} of {boxCount} units visible</small></div>
        <input aria-label="Visible cargo count" type="range" min="0" max={boxCount} value={visible} disabled={!boxCount} onChange={event => { setPlaying(false); setStep(Number(event.target.value)) }}/>
        <button className="btn" disabled={!result} onClick={() => { setPlaying(false); setStep(null) }}>Show all</button>
      </div>
    </section>

    <aside className="panel performance">
      <span className="eyebrow">03 / UNDERSTAND</span>
      <h2>Load overview</h2>
      <div className="score-card">
        <span>Plan score</span>
        <strong>{result ? result.metrics.score : '—'}<small>/100</small></strong>
        <p>{!result ? 'Waiting for a valid plan' : result.unloaded.length ? result.unloaded.length + ' units need attention' : boxCount ? 'All requested units placed' : 'Add cargo to begin'}</p>
      </div>
      <Metric label="Space utilization" value={result?.metrics.spaceUtil} description={result ? fmt(result.metrics.volume) + ' / ' + fmt(volume) + ' m³' : 'Recalculating'} color="#5479df"/>
      <Metric label="Payload utilization" value={result?.metrics.weightUtil} description={result ? fmt(result.metrics.totalWeight) + ' / ' + fmt(truck.maxWeight) + ' kg' : 'Recalculating'} color={result && result.metrics.weightUtil > 100 ? '#ca423f' : '#d78956'}/>
      {result && result.metrics.weightUtil > 100 && <p className="inline-error">Over payload by {fmt(result.metrics.totalWeight - truck.maxWeight)} kg</p>}
      {axle && <>
        <Metric label="Front axle cargo load" value={axle.front / axle.frontLimit * 100} description={fmt(axle.front) + ' / ' + fmt(axle.frontLimit) + ' kg'} color={axle.front > axle.frontLimit ? '#ca423f' : '#349988'}/>
        <Metric label="Rear axle cargo load" value={axle.rear / axle.rearLimit * 100} description={fmt(axle.rear) + ' / ' + fmt(axle.rearLimit) + ' kg'} color={axle.rear > axle.rearLimit ? '#ca423f' : '#349988'}/>
        {(axle.front > axle.frontLimit || axle.rear > axle.rearLimit) && <p className="inline-error">Axle limit exceeded. Move heavy cargo or reduce the load.</p>}
        {axle.front < 0 && <p className="inline-error">The load sits behind the rear axle and lifts weight off the front axle.</p>}
      </>}
      <div className="section-heading"><h3>Weight distribution</h3></div>
      <p className="helper">Share of cargo mass in each half{axle ? '.' : '; not axle loads.'}</p>
      <div className="balance-values">
        <span>Left <b>{result ? fmt(result.metrics.balance.left, 0) + '%' : '—'}</b></span>
        <span>Right <b>{result ? fmt(result.metrics.balance.right, 0) + '%' : '—'}</b></span>
      </div>
      <div className="balance-track"><i style={{ width: (result?.metrics.balance.left ?? 50) + '%' }}/></div>
      <div className="cog-grid">
        {(['x', 'z', 'y'] as const).map((axis, i) => <div key={axis}>
          <span>{['Length', 'Width', 'Height'][i]}</span>
          <b>{result ? fmt(result.metrics.cog[axis], 2) + ' m' : '—'}</b>
        </div>)}
      </div>
      <p className="helper">Center of gravity measured from the front-left floor corner.</p>
      {selectedBox && <div className="selected-card">
        <div><b>{selectedBox.name}</b><button className="icon-btn" aria-label="Clear selection" onClick={() => setSelected(undefined)}><X size={14}/></button></div>
        <p>{selectedBox.id} · {fmt(selectedBox.weight)} kg · Level {selectedBox.level}{multiStop && ' · Stop ' + selectedBox.stop}</p>
        <p>Load above: {fmt(selectedBox.loadAbove)} / {fmt(selectedBox.maxStackWeight)} kg</p>
        <p>Gravity load: {fmt(selectedBox.gravitationalForce)} N</p>
      </div>}
      <button className="btn primary optimize-btn" disabled={!valid || busy} onClick={onOptimize}><Sparkles size={17}/>{busy ? 'Calculating…' : 'Optimize loading'}</button>
      <button className="btn full-width" onClick={onOpenReports}>View loading manifest<ArrowUpRight size={15}/></button>
    </aside>
  </div>
}
