import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from './load.mjs'

const { optimize } = await load('src/algorithms/packing.ts')
const { parseProject, validateInputs, cargoCsv } = await load('src/lib/project.ts')
const { verifyCredentials } = await load('src/lib/auth.ts')
const truck = { name: 'Test', length: 3, width: 1, height: 3, maxWeight: 100 }
const box = { id: 'A', name: 'Box', length: 1, width: 1, height: 1, weight: 60, maxStackWeight: 200, quantity: 2, priority: 'High', color: '#5479df', rotate: true, stackable: true, stop: 1 }

test('every constrained strategy obeys payload', () => {
  for (const mode of ['maximize-items', 'weight-aware', 'compact-stack']) {
    const result = optimize(truck, [box], { mode })
    assert.equal(result.metrics.loaded, 1)
    assert.equal(result.metrics.totalWeight, 60)
    assert.deepEqual(result.unloaded, ['A-02'])
  }
  assert.equal(optimize(truck, [box], { mode: 'space-only' }).metrics.totalWeight, 120)
})
test('reject zero dimensions, fractions, nonfinite numbers and excessive quantities', () => {
  for (const change of [{ length: 0 }, { quantity: 1.5 }, { weight: Infinity }, { quantity: 151 }, { maxStackWeight: -1 }]) assert.throws(() => optimize(truck, [{ ...box, ...change }]))
  assert.throws(() => optimize({ ...truck, width: 0 }, [box]))
  assert.ok(validateInputs(truck, [box, box]).length)
})
test('legacy fragile migration prevents cargo above', () => {
  const project = parseProject(JSON.stringify({ truck, cargo: [{ ...box, fragile: true }], name: 'Legacy' }))
  assert.equal(project.cargo[0].stackable, false)
  assert.equal(project.cargo[0].maxStackWeight, 0)
})
test('project import roundtrips exports and rejects malformed input', () => {
  const project = { name: 'Shipment', truck, cargo: [box], optimizationMode: 'compact-stack' }
  assert.deepEqual(parseProject(JSON.stringify({ ...project, result: {} })), project)
  assert.equal(parseProject(JSON.stringify({ project: 'Old export', truck, cargo: [box] })).name, 'Old export')
  for (const value of [{}, { truck, cargo: [null] }, { ...project, optimizationMode: 'invalid' }, { ...project, cargo: [{ ...box, weight: '100' }] }]) assert.throws(() => parseProject(JSON.stringify(value)))
})
test('nonstackable cargo may sit on a base but cannot support another box', () => {
  const base = { ...box, quantity: 1, weight: 10 }
  const fragile = { ...box, id: 'B', priority: 'Medium', quantity: 2, weight: 10, stackable: false, maxStackWeight: 0 }
  const result = optimize({ ...truck, length: 1 }, [base, fragile], { mode: 'compact-stack' })
  assert.equal(result.boxes.length, 2)
  assert.deepEqual(result.boxes[1].supportedBy, ['A-01'])
})
test('load above includes all layers and capacity stops excess layers', () => {
  const result = optimize({ ...truck, length: 1, height: 4 }, [{ ...box, quantity: 4, weight: 10, maxStackWeight: 20 }], { mode: 'compact-stack' })
  assert.equal(result.boxes.length, 3)
  assert.equal(result.boxes[0].loadAbove, 20)
  assert.equal(result.boxes[0].totalLoad, 30)
  assert.ok(Math.abs(result.boxes[0].gravitationalForce - 30 * 9.80665) < 1e-8)
})
test('centered cargo splits mass evenly and sub-kilogram center is correct', () => {
  const result = optimize({ ...truck, length: 1, height: 1 }, [{ ...box, weight: 0.1, quantity: 1 }])
  assert.equal(result.metrics.balance.left, 50)
  assert.equal(result.metrics.balance.front, 50)
  assert.equal(result.metrics.cog.x, 0.5)
})
test('empty shipment clears the result and score', () => {
  const result = optimize(truck, [])
  assert.equal(result.metrics.score, 0)
  assert.equal(result.boxes.length, 0)
})
test('CSV retains constraints, escapes quotes and neutralizes formulas', () => {
  const csv = cargoCsv([{ ...box, name: '=SUM(1,2) "test"' }])
  assert.ok(csv.includes('maxStackWeight,stackable,rotate,color,stop'))
  assert.ok(csv.includes('"\'=SUM(1,2) ""test"""'))
})
test('rotated fit, non-overlap, bounds and support capacities hold', () => {
  const rotated = optimize({ ...truck, length: 1, width: 2 }, [{ ...box, length: 2, width: 1, quantity: 1 }])
  assert.equal(rotated.boxes.length, 1)
  assert.deepEqual(rotated.boxes[0].dimensions, [1, 2, 1])
  const items = Array.from({ length: 5 }, (_, i) => ({ ...box, id: 'T' + i, weight: 2 + i, length: 0.3 + i * 0.1, width: 0.4, height: 0.3, quantity: 4 }))
  const result = optimize(truck, items, { mode: 'compact-stack' })
  assert.ok(result.boxes.length > 0)
  for (const a of result.boxes) {
    assert.ok(a.loadAbove <= a.maxStackWeight + 1e-8)
    for (const [axis, index, limit] of [['x', 0, truck.length], ['y', 2, truck.height], ['z', 1, truck.width]]) {
      assert.ok(a.position[axis] - a.dimensions[index] / 2 >= -1e-8)
      assert.ok(a.position[axis] + a.dimensions[index] / 2 <= limit + 1e-8)
    }
    for (const b of result.boxes) {
      if (a === b) continue
      const intersects = [['x', 0], ['y', 2], ['z', 1]].every(([axis, i]) => Math.abs(a.position[axis] - b.position[axis]) < (a.dimensions[i] + b.dimensions[i]) / 2 - 1e-8)
      assert.equal(intersects, false)
    }
  }
})
test('sign-in accepts only the configured account', async () => {
  assert.equal(await verifyCredentials('USER1', 'User1234!'), true)
  assert.equal(await verifyCredentials(' USER1 ', 'User1234!'), true)
  for (const [user, password] of [['USER1', 'user1234!'], ['user1', 'User1234!'], ['USER2', 'User1234!'], ['USER1', '']]) assert.equal(await verifyCredentials(user, password), false)
})
test('maximize-items keeps the order that loads the most units', () => {
  const small = { ...box, id: 'S', length: 0.5, width: 0.5, height: 0.5, weight: 1, quantity: 1 }
  const large = { ...box, id: 'L', weight: 1, quantity: 2 }
  const result = optimize({ ...truck, length: 1, height: 2 }, [small, large], { mode: 'maximize-items' })
  assert.equal(result.metrics.loaded, 2)
  assert.deepEqual(result.unloaded, ['S-01'])
})
test('load is centered across the vehicle width', () => {
  for (const mode of ['compact-stack', 'maximize-items', 'weight-aware', 'space-only']) {
    const result = optimize({ ...truck, width: 3 }, [{ ...box, quantity: 1 }], { mode })
    assert.equal(result.boxes[0].position.z, 1.5)
    assert.equal(result.metrics.balance.left, 50)
  }
})
