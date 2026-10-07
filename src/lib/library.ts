import { demoCargo, demoTruck } from '../data/demo'
import { normalizeProject } from './project'
import type { Project } from './project'

export const MAX_PROJECTS = 30
export interface SavedProject { id: string; updated: number; project: Project }
export interface Library { current: string; projects: SavedProject[] }

const KEY = 'smartload-library'
const LEGACY_KEY = 'smartload-project'

export const newProjectId = () => 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
export const demoProject = (): Project => ({ name: 'Morning dispatch', truck: { ...demoTruck }, cargo: demoCargo.map(item => ({ ...item })), optimizationMode: 'compact-stack' })
export const emptyProject = (name: string): Project => ({ name, truck: { ...demoTruck }, cargo: [], optimizationMode: 'compact-stack' })
const single = (project: Project): Library => { const id = newProjectId(); return { current: id, projects: [{ id, updated: Date.now(), project }] } }

/** Open the saved projects. On damaged data the demo is loaded and `error` explains why,
 * so the caller can hold back autosave instead of overwriting what is stored. */
export function loadLibrary(): { library: Library; error: string } {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) {
      // Before multiple projects existed, the single project was stored under its own key.
      const legacy = localStorage.getItem(LEGACY_KEY)
      return { library: single(legacy ? normalizeProject(JSON.parse(legacy)) : demoProject()), error: '' }
    }
    const value = JSON.parse(saved)
    const projects: SavedProject[] = []
    let damaged = 0
    for (const entry of Array.isArray(value?.projects) ? value.projects : []) {
      try { projects.push({ id: String(entry.id), updated: Number(entry.updated) || Date.now(), project: normalizeProject(entry.project) }) }
      catch { damaged++ }
    }
    if (!projects.length) throw new Error('No readable projects.')
    const current = projects.some(entry => entry.id === value.current) ? value.current : projects[0].id
    return { library: { current, projects }, error: damaged ? damaged + ' saved project' + (damaged > 1 ? 's' : '') + ' could not be opened. Save manually to keep only the projects listed.' : '' }
  } catch {
    return { library: single(demoProject()), error: 'Saved projects could not be opened. Demo loaded; save manually to replace the stored copy.' }
  }
}

export function storeLibrary(library: Library): void {
  localStorage.setItem(KEY, JSON.stringify({ version: 2, ...library }))
}
