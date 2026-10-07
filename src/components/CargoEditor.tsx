import { Check, X } from 'lucide-react'
import type { CargoItem } from '../types'
import { MAX_STOPS } from '../lib/project'
import { Field } from './Field'

type NumberKey = 'length' | 'width' | 'height' | 'weight' | 'quantity' | 'maxStackWeight' | 'stop'

export function CargoEditor({ item, onChange, onClose }: { item: CargoItem; onChange: (item: CargoItem) => void; onClose: () => void }) {
  const number = (key: NumberKey, label: string, unit: string) => {
    const whole = key === 'quantity' || key === 'stop'
    const min = key === 'stop' ? 1 : key === 'quantity' || key === 'maxStackWeight' ? 0 : 0.001
    return <Field label={label} value={item[key]} unit={unit} min={min} step={whole ? '1' : 'any'} onChange={value => onChange({ ...item, [key]: Number(value) })}/>
  }

  return <>
    <div className="panel-heading">
      <div><span className="eyebrow">CARGO DETAILS</span><h2>{item.id}</h2></div>
      <button className="icon-btn" aria-label="Close editor" onClick={onClose}><X size={18}/></button>
    </div>
    <Field label="Cargo name" value={item.name} onChange={value => onChange({ ...item, name: value })}/>
    <div className="field-grid">
      {number('length', 'Length', 'm')}
      {number('width', 'Width', 'm')}
      {number('height', 'Height', 'm')}
      {number('weight', 'Weight', 'kg')}
      {number('quantity', 'Quantity', 'units')}
      {number('maxStackWeight', 'Max load above', 'kg')}
      <label className="field">
        <span>Priority</span>
        <select value={item.priority} onChange={event => onChange({ ...item, priority: event.target.value as CargoItem['priority'] })}>
          {['High', 'Medium', 'Low'].map(priority => <option key={priority}>{priority}</option>)}
        </select>
      </label>
      {number('stop', 'Delivery stop', 'of ' + MAX_STOPS)}
      <label className="field">
        <span>Box color</span>
        <input className="color-input" type="color" value={item.color} onChange={event => onChange({ ...item, color: event.target.value })}/>
      </label>
    </div>
    <p className="helper">Stop 1 is unloaded first, so it is loaded nearest the rear door.</p>
    <label className="checkbox">
      <input type="checkbox" checked={item.rotate} onChange={event => onChange({ ...item, rotate: event.target.checked })}/>
      <span>Allow horizontal rotation<small>Keep the upright orientation.</small></span>
    </label>
    <label className="checkbox">
      <input type="checkbox" checked={item.stackable} onChange={event => onChange({ ...item, stackable: event.target.checked })}/>
      <span>Can support cargo above<small>Turn off for fragile goods. It may still sit on a supported base.</small></span>
    </label>
    <p className="helper"><Check size={13}/> Changes are applied automatically.</p>
  </>
}
