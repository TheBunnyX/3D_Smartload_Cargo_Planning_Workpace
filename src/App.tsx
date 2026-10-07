import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, FilePlus2, Layers3, LogOut, RotateCcw, Save, Upload, X } from 'lucide-react'
import { ProjectDialog } from './components/ProjectDialog'
import { usePlan } from './hooks/usePlan'
import { importCargoFile } from './lib/cargoImport'
import { download } from './lib/format'
import { emptyProject, loadLibrary, MAX_PROJECTS, newProjectId, storeLibrary } from './lib/library'
import type { Library } from './lib/library'
import { cargoColors, MAX_UNITS, nextId, parseProject, validateInputs } from './lib/project'
import type { Project } from './lib/project'
import { CargoPage } from './pages/CargoPage'
import { PlannerPage } from './pages/PlannerPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'
import type { CargoItem } from './types'

const pages = ['Planner', 'Cargo', 'Reports', 'Projects'] as const
type Page = typeof pages[number]

export function App({ user, onLogout }: { user: string; onLogout: () => void }) {
  const [initial] = useState(loadLibrary)
  const [library, setLibrary] = useState<Library>(initial.library)
  const [page, setPage] = useState<Page>('Planner')
  const [saveStatus, setSaveStatus] = useState(initial.error || 'Saved locally')
  const [autoSave, setAutoSave] = useState(!initial.error)
  const [toast, setToast] = useState('')
  const [editing, setEditing] = useState<string>()
  const [deleted, setDeleted] = useState<{ item: CargoItem; index: number }[]>([])
  const [dialog, setDialog] = useState<'new' | 'rename'>()
  const [dialogName, setDialogName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const project = library.projects.find(entry => entry.id === library.current)!.project
  const { name, truck, cargo, optimizationMode } = project
  const errors = useMemo(() => validateInputs(truck, cargo), [truck, cargo])
  const plan = usePlan(project, !errors.length)
  const totalUnits = cargo.reduce((sum, item) => sum + item.quantity, 0)

  const setProject = (update: (current: Project) => Project) => setLibrary(current => ({
    ...current,
    projects: current.projects.map(entry => entry.id === current.current ? { ...entry, updated: Date.now(), project: update(entry.project) } : entry),
  }))

  useEffect(() => {
    if (!autoSave) return
    if (errors.length) { setSaveStatus('Unsaved · fix input errors'); return }
    setSaveStatus('Saving…')
    const timer = window.setTimeout(() => {
      try { storeLibrary(library); setSaveStatus('Saved locally') }
      catch { setSaveStatus('Browser storage unavailable · export a backup') }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [library, autoSave, errors.length])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Cargo
  const updateCargo = (item: CargoItem) => setProject(current => ({ ...current, cargo: current.cargo.map(c => c.id === item.id ? item : c) }))
  const editCargo = (id: string) => { setEditing(id); setPage('Cargo') }
  const addCargo = (source?: CargoItem) => {
    if (cargo.length >= MAX_UNITS || totalUnits >= MAX_UNITS) { setToast('This plan supports up to ' + MAX_UNITS + ' units.'); return }
    const item: CargoItem = source
      ? { ...source, id: nextId(cargo), name: source.name + ' copy', quantity: 1 }
      : { id: nextId(cargo), name: 'New cargo', length: 1, width: 0.8, height: 0.8, weight: 100, maxStackWeight: 200, quantity: 1, priority: 'Medium', color: cargoColors[cargo.length % cargoColors.length], rotate: true, stackable: true, stop: 1 }
    setProject(current => ({ ...current, cargo: [...current.cargo, item] }))
    editCargo(item.id)
  }
  const removeCargo = (item: CargoItem) => {
    setDeleted(current => [...current, { item, index: cargo.indexOf(item) }])
    setProject(current => ({ ...current, cargo: current.cargo.filter(c => c.id !== item.id) }))
    if (editing === item.id) setEditing(undefined)
  }
  const undoDelete = () => {
    const last = deleted[deleted.length - 1]
    if (!last) return
    const next = [...cargo]
    next.splice(last.index, 0, { ...last.item, id: cargo.some(item => item.id === last.item.id) ? nextId(cargo) : last.item.id })
    setProject(current => ({ ...current, cargo: next }))
    setDeleted(current => current.slice(0, -1))
  }
  const importCargo = async (file: File) => {
    try {
      const items = await importCargoFile(file, cargo)
      const problems = validateInputs(truck, [...cargo, ...items])
      if (problems.length) throw new Error(problems[0])
      setProject(current => ({ ...current, cargo: [...current.cargo, ...items] }))
      setToast('Added ' + items.length + ' cargo type' + (items.length > 1 ? 's' : '') + ' from ' + file.name + '.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not import this file.') }
  }

  // Projects
  const leaveProject = () => {
    if (errors.length) { setToast('Fix the input errors in this project first.'); return false }
    setEditing(undefined)
    setDeleted([])
    return true
  }
  const addProject = (next: Project) => {
    if (library.projects.length >= MAX_PROJECTS) { setToast('This browser keeps up to ' + MAX_PROJECTS + ' projects. Delete one first.'); return false }
    if (!leaveProject()) return false
    const id = newProjectId()
    setLibrary(current => ({ current: id, projects: [...current.projects, { id, updated: Date.now(), project: next }] }))
    setAutoSave(true)
    setPage('Planner')
    return true
  }
  const openProject = (id: string) => {
    if (id !== library.current) {
      if (!leaveProject()) return
      setLibrary(current => ({ ...current, current: id }))
    }
    setPage('Planner')
  }
  const duplicateProject = (id: string) => {
    const source = library.projects.find(entry => entry.id === id)
    if (source && addProject({ ...source.project, name: source.project.name + ' copy' })) setToast('Project duplicated.')
  }
  const deleteProject = (id: string) => {
    const target = library.projects.find(entry => entry.id === id)
    if (!target || library.projects.length < 2) return
    if (!window.confirm('Delete “' + target.project.name + '”? This cannot be undone.')) return
    if (id === library.current) { setEditing(undefined); setDeleted([]) }
    setLibrary(current => {
      const projects = current.projects.filter(entry => entry.id !== id)
      return { current: id === current.current ? projects[0].id : current.current, projects }
    })
    setToast('Project deleted.')
  }
  const submitDialog = () => {
    const nextName = dialogName.trim()
    if (!nextName) return
    if (dialog === 'new') addProject(emptyProject(nextName))
    else setProject(current => ({ ...current, name: nextName }))
    setDialog(undefined)
  }
  const openNewDialog = () => { setDialog('new'); setDialogName('New loading plan') }

  // Save, export and import
  const save = () => {
    if (errors.length) { setToast('Fix input errors before saving.'); return }
    try { storeLibrary(library); setAutoSave(true); setSaveStatus('Saved locally'); setToast('Projects saved in this browser.') }
    catch { setToast('Storage is unavailable. Export JSON to keep a backup.'); setSaveStatus('Not saved') }
  }
  const exportProject = () => {
    if (!plan.result) { setToast('Wait for a valid plan before exporting.'); return }
    download('3dsmartload-plan.json', JSON.stringify({ ...project, version: 2, result: plan.result }, null, 2))
    setToast('Project and loading plan exported.')
  }
  const importProject = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('Project file must be smaller than 2 MB.')
      if (addProject(parseProject(await file.text()))) setToast('Project imported as a new project.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not import this file.') }
  }

  const lastDeleted = deleted[deleted.length - 1]
  return <main>
    <header className="app-header">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setPage('Planner') }}><span className="brandmark"><Layers3 size={21}/></span>3DSmartLoad</a>
      <nav aria-label="Main navigation">
        {pages.map(tab => <button key={tab} className={page === tab ? 'active' : ''} onClick={() => setPage(tab)}>{tab}</button>)}
      </nav>
      <div className="header-actions">
        <button className="btn" onClick={() => fileInput.current?.click()}><Upload size={15}/>Import</button>
        <button className="btn" onClick={save}><Save size={15}/>Save</button>
        <button className="btn primary" onClick={exportProject} disabled={!plan.result}><Download size={15}/>Export plan</button>
        <span className="user-chip">{user}</span>
        <button className="btn" onClick={onLogout}><LogOut size={15}/>Sign out</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden aria-label="Import project JSON" onChange={event => { void importProject(event.target.files?.[0]); event.target.value = '' }}/>
    </header>

    <div className="project-bar">
      <div>
        <span className="eyebrow">YOUR WORKSPACE</span>
        <button className="project-title" onClick={() => { setDialog('rename'); setDialogName(name) }}>{name}<ChevronDown size={16}/></button>
        <span className="save-status"><span className="status-dot"/>{saveStatus}</span>
      </div>
      <button className="btn" onClick={openNewDialog}><FilePlus2 size={15}/>New project</button>
    </div>

    {errors.length > 0 && <div className="notice error" role="alert">
      <b>Check your inputs</b>
      <ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>
    </div>}
    {plan.error && <div className="notice error" role="alert">{plan.error}<button className="btn" onClick={plan.retry}>Retry</button></div>}
    {optimizationMode === 'space-only' && <div className="notice warning">Space-only mode ignores vehicle payload. Switch to another mode for a payload-constrained plan.</div>}
    {lastDeleted && <div className="notice undo" role="status">
      Removed {lastDeleted.item.name}{deleted.length > 1 && ' and ' + (deleted.length - 1) + ' more'}
      <button className="btn" onClick={undoDelete}><RotateCcw size={14}/>Undo</button>
      <button className="icon-btn" aria-label="Dismiss undo" onClick={() => setDeleted([])}><X size={15}/></button>
    </div>}

    {page === 'Planner' && <PlannerPage project={project} setProject={setProject} valid={!errors.length} result={plan.result} busy={plan.busy}
      onOptimize={plan.recalculate} onAddCargo={() => addCargo()} onEditCargo={editCargo} onOpenReports={() => setPage('Reports')} notify={setToast}/>}
    {page === 'Cargo' && <CargoPage cargo={cargo} editing={editing} onEdit={setEditing} onAdd={addCargo} onRemove={removeCargo} onUpdate={updateCargo} onImport={file => void importCargo(file)}/>}
    {page === 'Reports' && <ReportsPage project={project} result={plan.result} busy={plan.busy}
      onUseMode={mode => setProject(current => ({ ...current, optimizationMode: mode }))} onEditCargo={editCargo}/>}
    {page === 'Projects' && <ProjectsPage library={library} onOpen={openProject} onDuplicate={duplicateProject} onDelete={deleteProject} onNew={openNewDialog}/>}

    <footer><span>3DSMARTLOAD / Make every cubic meter count.</span><span>Local workspace · Metric units</span></footer>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {dialog && <ProjectDialog mode={dialog} name={dialogName} onName={setDialogName} onClose={() => setDialog(undefined)} onSubmit={submitDialog}/>}
  </main>
}
