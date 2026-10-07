import type { CargoItem, Priority } from '../types'
import { cargoColors, MAX_UNITS, nextId, validateCargoItem } from './project'

/** Parse CSV text into rows. Handles quoted cells, a BOM, CRLF and comma, semicolon or tab delimiters. */
export function parseCsv(input: string): string[][] {
  const source = input.replace(/^﻿/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, candidate) => firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best, ',')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++ }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell === '') quoted = true
    else if (char === delimiter) { row.push(cell); cell = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const decodeXml = (value: string) => value.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) => {
  const named: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]
  return String.fromCodePoint(entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10))
})
const textRuns = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match => decodeXml(match[1])).join('')

/** Read the files inside a ZIP archive (an .xlsx workbook is one). */
async function unzip(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(data), view = new DataView(data)
  let end = bytes.length - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('This file is not a valid Excel workbook.')
  const files = new Map<string, Uint8Array>()
  let offset = view.getUint32(end + 16, true)
  for (let entry = 0; entry < view.getUint16(end + 10, true); entry++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('This file is not a valid Excel workbook.')
    const method = view.getUint16(offset + 10, true), size = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true), extraLength = view.getUint16(offset + 30, true), commentLength = view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const compressed = bytes.slice(start, start + size)
    if (method === 0) files.set(name, compressed)
    else if (method === 8) files.set(name, new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

/** Read the first worksheet of an .xlsx workbook into rows of text. */
export async function readXlsx(data: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(data)
  const read = (name: string) => { const file = files.get(name); return file ? new TextDecoder().decode(file) : '' }
  const sheetName = files.has('xl/worksheets/sheet1.xml') ? 'xl/worksheets/sheet1.xml' : [...files.keys()].filter(name => /^xl\/worksheets\/[^/]+\.xml$/.test(name)).sort()[0]
  if (!sheetName) throw new Error('This workbook has no worksheet to import.')
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => textRuns(match[1]))
  const rows: string[][] = []
  for (const rowMatch of read(sheetName).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    let column = 0
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = /\br="([A-Z]+)\d+"/.exec(cell[1])
      if (reference) column = [...reference[1]].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
      const type = /\bt="(\w+)"/.exec(cell[1])?.[1], body = cell[2] ?? ''
      const value = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
      row[column] = type === 's' ? shared[Number(value)] ?? '' : type === 'inlineStr' ? textRuns(body) : type === 'b' ? (value === '1' ? 'TRUE' : 'FALSE') : decodeXml(value)
      column++
    }
    rows.push(Array.from(row, value => value ?? ''))
  }
  return rows
}

const columns: Record<string, keyof CargoItem> = {
  id: 'id', cargoid: 'id',
  name: 'name', cargo: 'name', description: 'name', item: 'name',
  length: 'length', lengthm: 'length', l: 'length',
  width: 'width', widthm: 'width', w: 'width',
  height: 'height', heightm: 'height', h: 'height',
  weight: 'weight', weightkg: 'weight', mass: 'weight', masskg: 'weight',
  quantity: 'quantity', qty: 'quantity', units: 'quantity',
  priority: 'priority',
  maxstackweight: 'maxStackWeight', maxloadabove: 'maxStackWeight', maxloadabovekg: 'maxStackWeight',
  stackable: 'stackable', rotate: 'rotate', rotation: 'rotate',
  color: 'color', colour: 'color',
  stop: 'stop', deliverystop: 'stop', drop: 'stop',
}
const required: (keyof CargoItem)[] = ['name', 'length', 'width', 'height', 'weight']

/** Turn spreadsheet rows (header row first) into cargo items, with defaults for optional columns. */
export function cargoFromRows(rows: string[][], existing: CargoItem[]): CargoItem[] {
  // Exported CSV prefixes formula-like text with an apostrophe; drop it again on the way in.
  const clean = (value: string | undefined) => (value ?? '').trim().replace(/^'(?=\s*[=+@-])/, '')
  const filled = rows.filter(row => row.some(value => clean(value) !== ''))
  if (!filled.length) throw new Error('The file is empty.')
  const header = filled[0].map(value => columns[clean(value).toLowerCase().replace(/\(.*?\)/g, '').replace(/[\s_\-.]/g, '')])
  const missing = required.filter(key => !header.includes(key))
  if (missing.length) throw new Error('Missing column' + (missing.length > 1 ? 's' : '') + ': ' + missing.join(', ') + '. The first row must contain column names.')
  if (filled.length - 1 > MAX_UNITS) throw new Error(`Import up to ${MAX_UNITS} cargo rows at a time.`)

  const items: CargoItem[] = []
  filled.slice(1).forEach((row, index) => {
    const line = 'Row ' + (index + 2)
    const get = (key: keyof CargoItem) => { const column = header.indexOf(key); return column < 0 ? '' : clean(row[column]) }
    const number = (key: keyof CargoItem, fallback?: number) => { const value = get(key); return value === '' && fallback !== undefined ? fallback : value === '' ? NaN : Number(value) }
    const flag = (key: keyof CargoItem) => {
      const value = get(key).toLowerCase()
      if (value === '') return true
      if (['true', 'yes', 'y', '1'].includes(value)) return true
      if (['false', 'no', 'n', '0'].includes(value)) return false
      throw new Error(`${line}: ${key} must be TRUE or FALSE.`)
    }
    const taken = [...existing, ...items]
    const weight = number('weight'), priority = get('priority').toLowerCase()
    const item: CargoItem = {
      id: get('id') && !taken.some(other => other.id === get('id')) ? get('id') : nextId(taken),
      name: get('name'),
      length: number('length'), width: number('width'), height: number('height'), weight,
      maxStackWeight: number('maxStackWeight', weight * 2),
      quantity: number('quantity', 1),
      priority: (priority === '' ? 'Medium' : priority[0].toUpperCase() + priority.slice(1)) as Priority,
      color: get('color') || cargoColors[taken.length % cargoColors.length],
      rotate: flag('rotate'), stackable: flag('stackable'),
      stop: number('stop', 1),
    }
    const errors = validateCargoItem(item)
    if (errors.length) throw new Error(`${line}: ${errors[0]}`)
    items.push(item)
  })
  if (!items.length) throw new Error('The file has column names but no cargo rows.')
  return items
}

/** Read a .csv or .xlsx file chosen by the user into cargo items. */
export async function importCargoFile(file: File, existing: CargoItem[]): Promise<CargoItem[]> {
  if (file.size > 2_000_000) throw new Error('Cargo file must be smaller than 2 MB.')
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) return cargoFromRows(await readXlsx(await file.arrayBuffer()), existing)
  if (name.endsWith('.xls')) throw new Error('Old .xls workbooks are not supported. Save the file as .xlsx or .csv.')
  return cargoFromRows(parseCsv(await file.text()), existing)
}
