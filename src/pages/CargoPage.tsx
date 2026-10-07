import { useRef, useState } from 'react'
import { Box, Copy, Download, Plus, Search, Trash2, Upload } from 'lucide-react'
import { CargoEditor } from '../components/CargoEditor'
import { download, fmt } from '../lib/format'
import { cargoCsv } from '../lib/project'
import type { CargoItem } from '../types'

export function CargoPage({ cargo, editing, onEdit, onAdd, onRemove, onUpdate, onImport }: {
  cargo: CargoItem[]; editing?: string; onEdit: (id?: string) => void
  onAdd: (source?: CargoItem) => void; onRemove: (item: CargoItem) => void; onUpdate: (item: CargoItem) => void
  onImport: (file: File) => void
}) {
  const [search, setSearch] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const rows = cargo.filter(item => (item.name + ' ' + item.id).toLowerCase().includes(search.toLowerCase()))
  const editorItem = cargo.find(item => item.id === editing)

  return <section className="page-content">
    <div className="page-heading">
      <div>
        <span className="eyebrow">CARGO LIBRARY</span>
        <h1>The details make the difference.</h1>
        <p>Define dimensions, priorities, delivery stops and stacking limits for each cargo type.</p>
      </div>
      <button className="btn primary" onClick={() => onAdd()}><Plus size={17}/>Add cargo</button>
    </div>
    <div className="cargo-layout">
      <div className="panel table-panel">
        <div className="table-toolbar">
          <label className="search">
            <Search size={17}/>
            <input aria-label="Search cargo" placeholder="Search name or ID…" value={search} onChange={event => setSearch(event.target.value)}/>
          </label>
          <div className="row-actions">
            <button className="btn" title="Add cargo from a .csv or .xlsx file" onClick={() => fileInput.current?.click()}><Upload size={15}/>Import CSV / Excel</button>
            <button className="btn" onClick={() => download('3dsmartload-cargo.csv', cargoCsv(cargo), 'text/csv;charset=utf-8')}><Download size={15}/>CSV</button>
          </div>
          <input ref={fileInput} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="Import cargo file"
            onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }}/>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Cargo</th><th>Dimensions</th><th>Weight</th><th>Qty</th><th>Stop</th><th>Priority</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(item => <tr key={item.id} className={editing === item.id ? 'row-selected' : ''}>
                <td>
                  <button className="cargo-name" onClick={() => onEdit(item.id)}>
                    <i style={{ background: item.color }}/>
                    <span><b>{item.name}</b><small>{item.id}</small></span>
                  </button>
                </td>
                <td>{item.length} × {item.width} × {item.height} m</td>
                <td>{fmt(item.weight)} kg</td>
                <td>{item.quantity}</td>
                <td>{item.stop}</td>
                <td><span className={'priority ' + item.priority.toLowerCase()}>{item.priority}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="btn small" onClick={() => onEdit(item.id)}>Edit</button>
                    <button className="icon-btn" aria-label={'Duplicate ' + item.name} onClick={() => onAdd(item)}><Copy size={15}/></button>
                    <button className="icon-btn danger" aria-label={'Delete ' + item.name} onClick={() => onRemove(item)}><Trash2 size={15}/></button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty-state">
          <Box size={30}/>
          <h3>{cargo.length ? 'No matching cargo' : 'Start your cargo collection'}</h3>
          <p>{cargo.length ? 'Try a different name or ID.' : 'Add a cargo item, or import a .csv or .xlsx file with name, length, width, height and weight columns.'}</p>
        </div>}
      </div>
      <aside className="panel editor-panel">
        {editorItem
          ? <CargoEditor item={editorItem} onChange={onUpdate} onClose={() => onEdit(undefined)}/>
          : <div className="empty-state">
              <Box size={32}/>
              <h3>A place for every detail</h3>
              <p>Select a cargo row to edit its dimensions, color and handling constraints.</p>
            </div>}
      </aside>
    </div>
  </section>
}
