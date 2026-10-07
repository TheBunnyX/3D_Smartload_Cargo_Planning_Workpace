import { Copy, FilePlus2, Trash2 } from 'lucide-react'
import { fmtDate } from '../lib/format'
import { MAX_PROJECTS } from '../lib/library'
import type { Library } from '../lib/library'

export function ProjectsPage({ library, onOpen, onDuplicate, onDelete, onNew }: {
  library: Library; onOpen: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void; onNew: () => void
}) {
  const projects = [...library.projects].sort((a, b) => b.updated - a.updated)

  return <section className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">PROJECTS</span>
        <h1>Every plan in one place.</h1>
        <p>{projects.length} of {MAX_PROJECTS} projects saved in this browser. Export a plan to back it up or move it to another device.</p>
      </div>
      <button className="btn primary" onClick={onNew}><FilePlus2 size={17}/>New project</button>
    </div>
    <div className="panel table-panel">
      <div className="table-scroll">
        <table>
          <thead><tr><th>Project</th><th>Vehicle</th><th>Cargo</th><th>Last change</th><th>Actions</th></tr></thead>
          <tbody>
            {projects.map(({ id, updated, project }) => <tr key={id} className={id === library.current ? 'row-selected' : ''}>
              <td>
                <button className="cargo-name" onClick={() => onOpen(id)}>
                  <span><b>{project.name}</b><small>{id === library.current ? 'Open now' : 'Saved'}</small></span>
                </button>
              </td>
              <td>{project.truck.name}</td>
              <td>{project.cargo.reduce((sum, item) => sum + item.quantity, 0)} units · {project.cargo.length} types</td>
              <td>{fmtDate(updated)}</td>
              <td>
                <div className="row-actions">
                  <button className="btn small" onClick={() => onOpen(id)}>{id === library.current ? 'View' : 'Open'}</button>
                  <button className="icon-btn" aria-label={'Duplicate ' + project.name} onClick={() => onDuplicate(id)}><Copy size={15}/></button>
                  <button className="icon-btn danger" aria-label={'Delete ' + project.name} disabled={projects.length < 2} onClick={() => onDelete(id)}><Trash2 size={15}/></button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </section>
}
