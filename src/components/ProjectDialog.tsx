import { useEffect, useRef } from 'react'
import { Field } from './Field'

export function ProjectDialog({ mode, name, onName, onClose, onSubmit }: {
  mode: 'new' | 'rename'; name: string; onName: (name: string) => void; onClose: () => void; onSubmit: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return <dialog className="project-dialog" ref={ref} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); onSubmit() }}>
      <span className="eyebrow">WORKSPACE</span>
      <h2>{mode === 'new' ? 'A fresh loading plan.' : 'Name your project.'}</h2>
      <p>{mode === 'new'
        ? 'Start with an empty cargo list. Your other projects stay saved in this browser; find them under Projects.'
        : 'Choose a name that your team will recognize.'}</p>
      <Field label="Project name" value={name} onChange={onName}/>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="submit" disabled={!name.trim()}>{mode === 'new' ? 'Create project' : 'Save name'}</button>
      </div>
    </form>
  </dialog>
}
