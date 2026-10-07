import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { deflateRawSync } from 'node:zlib'
import { load } from './load.mjs'

const { optimize, compareStrategies } = await load('src/algorithms/packing.ts')
const { cargoCsv, parseProject, validateInputs } = await load('src/lib/project.ts')
const { parseCsv, readXlsx, cargoFromRows } = await load('src/lib/cargoImport.ts')

const truck = { name: 'Test', length: 3, width: 1, height: 3, maxWeight: 1000 }
const box = { id: 'A', name: 'Box', length: 1, width: 1, height: 1, weight: 10, maxStackWeight: 200, quantity: 1, priority: 'High', color: '#5479df', rotate: true, stackable: true, stop: 1 }
const edges = b => ({ x0: b.position.x - b.dimensions[0] / 2, x1: b.position.x + b.dimensions[0] / 2, y0: b.position.y - b.dimensions[2] / 2, y1: b.position.y + b.dimensions[2] / 2, z0: b.position.z - b.dimensions[1] / 2, z1: b.position.z + b.dimensions[1] / 2 })

// --- Delivery stops ---
test('later stops are loaded first and sit deeper than earlier stops', () => {
  const result = optimize({ ...truck, height: 1 }, [box, { ...box, id: 'B', stop: 2 }, { ...box, id: 'C', stop: 3 }], { mode: 'weight-aware' })
  assert.deepEqual(result.boxes.map(b => b.cargoId), ['C', 'B', 'A'])
  assert.deepEqual(result.boxes.map(b => b.position.x), [0.5, 1.5, 2.5])
  assert.deepEqual(result.boxes.map(b => b.stop), [3, 2, 1])
})
test('a stop outranks priority when ordering the load', () => {
  const result = optimize({ ...truck, height: 1 }, [{ ...box, priority: 'High' }, { ...box, id: 'B', priority: 'Low', stop: 2 }], { mode: 'compact-stack' })
  assert.deepEqual(result.boxes.map(b => b.cargoId), ['B', 'A'])
})
test('no later-stop cargo stands between earlier-stop cargo and the rear door, or rests on it', () => {
  const cargo = Array.from({ length: 6 }, (_, i) => ({ ...box, id: 'S' + i, length: 0.4 + (i % 3) * 0.3, width: 0.5 + (i % 2) * 0.4, height: 0.4 + (i % 4) * 0.2, quantity: 5, stop: 1 + (i % 3) }))
  for (const mode of ['compact-stack', 'maximize-items', 'weight-aware', 'space-only']) {
    const result = optimize({ ...truck, length: 5, width: 2, height: 2 }, cargo, { mode })
    assert.ok(result.boxes.length > 10)
    for (const a of result.boxes) for (const b of result.boxes) {
      if (b.stop <= a.stop) continue
      const A = edges(a), B = edges(b)
      const sameLane = A.y0 < B.y1 - 1e-8 && A.y1 > B.y0 + 1e-8 && A.z0 < B.z1 - 1e-8 && A.z1 > B.z0 + 1e-8
      assert.ok(!(sameLane && B.x0 >= A.x1 - 1e-8), `${mode}: ${b.id} (stop ${b.stop}) blocks ${a.id} (stop ${a.stop})`)
      assert.ok(!b.supportedBy.includes(a.id), `${mode}: ${b.id} rests on earlier-stop ${a.id}`)
    }
  }
})
test('stops must be whole numbers from 1 to 20, and older projects default to stop 1', () => {
  for (const stop of [0, 1.5, 21, '2', undefined]) assert.ok(validateInputs(truck, [{ ...box, stop }]).length, 'stop ' + stop)
  const { stop, ...legacy } = box
  assert.equal(parseProject(JSON.stringify({ name: 'Old', truck, cargo: [legacy] })).cargo[0].stop, 1)
})

// --- Axle loads ---
test('axle loads split the cargo mass by its center of gravity', () => {
  const axles = { front: 0, rear: 4, frontLimit: 50, rearLimit: 50 }
  const { metrics } = optimize({ ...truck, length: 4, axles }, [{ ...box, weight: 100 }])
  assert.equal(metrics.cog.x, 0.5)
  assert.equal(metrics.axle.rear, 12.5)
  assert.equal(metrics.axle.front, 87.5)
  assert.equal(metrics.axle.frontLimit, 50)
  assert.equal(optimize(truck, [box]).metrics.axle, undefined)
})
test('an axle ahead of the cargo space carries less of a load placed at the front', () => {
  const { metrics } = optimize({ ...truck, length: 4, axles: { front: -1, rear: 3, frontLimit: 500, rearLimit: 500 } }, [{ ...box, weight: 100 }])
  assert.equal(metrics.axle.rear, 37.5)
  assert.equal(metrics.axle.front + metrics.axle.rear, 100)
})
test('invalid axle data is rejected and valid axle data survives import', () => {
  for (const axles of [{ front: 2, rear: 1, frontLimit: 1, rearLimit: 1 }, { front: 0, rear: 3, frontLimit: 0, rearLimit: 1 }, { front: '0', rear: 3, frontLimit: 1, rearLimit: 1 }, null, 'yes']) {
    assert.ok(validateInputs({ ...truck, axles }, [box]).length, JSON.stringify(axles))
  }
  const axles = { front: -1, rear: 2, frontLimit: 300, rearLimit: 800 }
  assert.deepEqual(parseProject(JSON.stringify({ name: 'P', truck: { ...truck, axles }, cargo: [box] })).truck.axles, axles)
})

// --- Strategy comparison ---
test('comparison reports every strategy and matches a direct run', () => {
  const cargo = [{ ...box, quantity: 4 }, { ...box, id: 'B', length: 0.5, width: 0.5, quantity: 6, stop: 2 }]
  const rows = compareStrategies(truck, cargo)
  assert.deepEqual(rows.map(row => row.mode), ['compact-stack', 'maximize-items', 'weight-aware', 'space-only'])
  for (const row of rows) assert.deepEqual(row.metrics, optimize(truck, cargo, { mode: row.mode }).metrics)
})

// --- Import: project JSON ---
test('project import keeps only known fields', () => {
  const project = parseProject(JSON.stringify({ name: 'P', extra: 1, truck: { ...truck, hacked: true }, cargo: [{ ...box, __proto__: { polluted: true }, onload: 'x' }] }))
  assert.deepEqual(Object.keys(project), ['name', 'truck', 'cargo', 'optimizationMode'])
  assert.deepEqual(project.truck, truck)
  assert.deepEqual(project.cargo, [box])
})

// --- Import: cargo CSV ---
test('CSV parser handles quotes, embedded delimiters and line breaks, BOM and semicolons', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n1,\r\n'), [['a', 'b'], ['x, "y"', 'line1\nline2'], ['1', '']])
  assert.deepEqual(parseCsv('name;length\nBox;1,5'), [['name', 'length'], ['Box', '1,5']])
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']])
})
test('exported cargo CSV imports back unchanged, including formula-like names', () => {
  const cargo = [box, { ...box, id: 'B', name: '=SUM(1,2) "test"', stackable: false, rotate: false, stop: 3, priority: 'Low', maxStackWeight: 0 }]
  assert.deepEqual(cargoFromRows(parseCsv(cargoCsv(cargo)), []), cargo)
})
test('cargo import fills defaults, accepts header variants and avoids duplicate IDs', () => {
  const items = cargoFromRows([['Cargo', 'Length (m)', 'width_m', 'H', 'Weight KG', 'qty'], ['Crate', '1', '0.8', '0.5', '40', '3'], ['', '', '', '', '', ''], ['Drum', '0.6', '0.6', '0.9', '100', '']], [{ ...box, id: 'BX-001' }])
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], { id: 'BX-002', name: 'Crate', length: 1, width: 0.8, height: 0.5, weight: 40, maxStackWeight: 80, quantity: 3, priority: 'Medium', color: '#d98b53', rotate: true, stackable: true, stop: 1 })
  assert.equal(items[1].id, 'BX-003')
  assert.equal(items[1].quantity, 1)
})
test('cargo import explains what is wrong and where', () => {
  assert.throws(() => cargoFromRows([], []), /empty/)
  assert.throws(() => cargoFromRows([['name', 'length']], []), /Missing columns: width, height, weight/)
  assert.throws(() => cargoFromRows([['name', 'length', 'width', 'height', 'weight']], []), /no cargo rows/)
  const header = ['name', 'length', 'width', 'height', 'weight', 'stackable', 'priority']
  assert.throws(() => cargoFromRows([header, ['Ok', '1', '1', '1', '1', '', ''], ['Bad', 'abc', '1', '1', '1', '', '']], []), /Row 3: Bad: dimensions and weight/)
  assert.throws(() => cargoFromRows([header, ['Bad', '1', '1', '1', '1', 'maybe', '']], []), /Row 2: stackable must be TRUE or FALSE/)
  assert.throws(() => cargoFromRows([header, ['Bad', '1', '1', '1', '1', '', 'urgent']], []), /Row 2: Bad: invalid priority/)
  assert.throws(() => cargoFromRows([header, ...Array.from({ length: 151 }, () => ['Box', '1', '1', '1', '1', '', ''])], []), /up to 150/)
})

// --- Import: Excel ---
test('reads a workbook written by a spreadsheet library', async () => {
  const data = await readFile('tests/fixtures/cargo.xlsx')
  const rows = await readXlsx(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  assert.deepEqual(rows[0], ['Name', 'Length (m)', 'Width (m)', 'Height (m)', 'Weight (kg)', 'Qty', 'Priority', 'Stackable', 'Stop'])
  const items = cargoFromRows(rows, [])
  assert.deepEqual(items.map(item => [item.name, item.length, item.width, item.height, item.weight, item.quantity, item.priority, item.stackable, item.stop]), [
    ['Pallet A & B', 1.2, 1, 1, 250, 4, 'High', true, 2],
    ['Carton <small>', 0.6, 0.4, 0.35, 25.5, 10, 'Low', false, 1],
    ['Drum', 0.6, 0.6, 0.9, 180, 1, 'Medium', true, 1],
  ])
})
test('reads stored and compressed entries, shared and inline strings, and sparse cells', async () => {
  const entries = [
    ['xl/sharedStrings.xml', '<sst><si><t>name</t></si><si><r><t>Rich </t></r><r><t xml:space="preserve">text</t></r></si></sst>', false],
    ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>inline &amp; more</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1.5</v></c><c r="C2" s="1"/><c r="D2" t="b"><v>1</v></c></row></sheetData></worksheet>', true],
  ]
  const parts = [], central = []
  let offset = 0
  for (const [name, text, compress] of entries) {
    const raw = Buffer.from(text), body = compress ? deflateRawSync(raw) : raw, file = Buffer.from(name)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(compress ? 8 : 0, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(file.length, 26)
    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(compress ? 8 : 0, 10); header.writeUInt32LE(body.length, 20); header.writeUInt32LE(raw.length, 24); header.writeUInt16LE(file.length, 28); header.writeUInt32LE(offset, 42)
    parts.push(local, file, body); central.push(header, file)
    offset += 30 + file.length + body.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  const zip = Buffer.concat([...parts, directory, end])
  assert.deepEqual(await readXlsx(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)), [['name', '', 'inline & more'], ['Rich text', '1.5', '', 'TRUE']])
  await assert.rejects(() => readXlsx(new TextEncoder().encode('not a workbook, just some text').buffer), /not a valid Excel workbook/)
})

// --- Saved projects ---
test('saved projects: first run, legacy migration, round trip and damaged data', async () => {
  const store = new Map()
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }
  const { loadLibrary, storeLibrary } = await load('src/lib/library.ts')
  const project = { name: 'Shipment', truck, cargo: [box], optimizationMode: 'weight-aware' }

  const first = loadLibrary()
  assert.equal(first.error, '')
  assert.equal(first.library.projects.length, 1)
  assert.equal(first.library.projects[0].project.name, 'Morning dispatch')
  assert.equal(first.library.current, first.library.projects[0].id)

  store.set('smartload-project', JSON.stringify({ ...project, version: 1 }))
  assert.deepEqual(loadLibrary().library.projects.map(entry => entry.project), [project])

  storeLibrary({ current: 'b', projects: [{ id: 'a', updated: 1, project }, { id: 'b', updated: 2, project: { ...project, name: 'Second' } }] })
  const saved = loadLibrary()
  assert.equal(saved.error, '')
  assert.equal(saved.library.current, 'b')
  assert.deepEqual(saved.library.projects.map(entry => [entry.id, entry.updated, entry.project.name]), [['a', 1, 'Shipment'], ['b', 2, 'Second']])

  store.set('smartload-library', JSON.stringify({ current: 'gone', projects: [{ id: 'a', updated: 1, project }, { id: 'bad', updated: 2, project: { name: 'Broken' } }] }))
  const partial = loadLibrary()
  assert.match(partial.error, /1 saved project could not be opened/)
  assert.deepEqual(partial.library.projects.map(entry => entry.id), ['a'])
  assert.equal(partial.library.current, 'a')

  store.set('smartload-library', '{not json')
  const broken = loadLibrary()
  assert.match(broken.error, /could not be opened/)
  assert.equal(broken.library.projects[0].project.name, 'Morning dispatch')
  delete globalThis.localStorage
})
