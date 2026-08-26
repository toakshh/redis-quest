import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'
import { estimateCommandCost, BASE_COST_MS } from './latency.js'

describe('estimateCommandCost — direct unit tests', () => {
  it('GET costs BASE_COST_MS', () => {
    const engine = createEngine()
    const cost = estimateCommandCost(engine, 'GET', ['GET', 'k'], { type: 'nil', value: null })
    expect(cost).toBe(BASE_COST_MS)
  })

  it('DEBUG SLEEP 0.1 costs 100', () => {
    const engine = createEngine()
    const cost = estimateCommandCost(
      engine,
      'DEBUG',
      ['DEBUG', 'SLEEP', '0.1'],
      { type: 'simple', value: 'OK' }
    )
    expect(cost).toBe(100)
  })

  it('a missing key costs the base amount', () => {
    const engine = createEngine()
    const cost = estimateCommandCost(engine, 'DEL', ['DEL', 'missing'], { type: 'integer', value: 0 }, 0)
    expect(cost).toBe(BASE_COST_MS)
  })
})

describe('estimateCommandCost — scales with keyspace / element size', () => {
  it('KEYS * costs more on a 1000-key db than on a 10-key db', () => {
    const small = createEngine()
    for (let i = 0; i < 10; i++) small.rawExecute('SET', `k${i}`, 'v')
    const smallCost = estimateCommandCost(small, 'KEYS', ['KEYS', '*'], { type: 'array', value: [] })

    const big = createEngine()
    for (let i = 0; i < 1000; i++) big.rawExecute('SET', `k${i}`, 'v')
    const bigCost = estimateCommandCost(big, 'KEYS', ['KEYS', '*'], { type: 'array', value: [] })

    expect(bigCost).toBeGreaterThan(smallCost)
  })

  it('DEL of a 5000-element list costs more than UNLINK of the same', () => {
    const engine = createEngine()
    engine.rawExecute('RPUSH', 'biglist', ...Array.from({ length: 5000 }, (_, i) => String(i)))
    const entry = engine.store.get('biglist')

    const delCost = estimateCommandCost(
      engine, 'DEL', ['DEL', 'biglist'], { type: 'integer', value: 1 },
      entry.value.length
    )
    const unlinkCost = estimateCommandCost(
      engine, 'UNLINK', ['UNLINK', 'biglist'], { type: 'integer', value: 1 },
      entry.value.length
    )
    expect(delCost).toBeGreaterThan(unlinkCost)
  })

  it('UNLINK never exceeds BASE_COST_MS * 2, no matter how large the collection', () => {
    const engine = createEngine()
    const cost = estimateCommandCost(
      engine, 'UNLINK', ['UNLINK', 'huge'], { type: 'integer', value: 1 }, 1_000_000
    )
    expect(cost).toBeLessThanOrEqual(BASE_COST_MS * 2)
  })
})

describe('estimateCommandCost — wired through the real engine', () => {
  it("the 'command' event carries costMs", () => {
    const engine = createEngine()
    const events = []
    engine.on('command', (payload) => events.push(payload))
    engine.execute('SET k v')
    expect(events[0].costMs).toBeGreaterThan(0)
  })

  it('DEL of a huge list produces a materially higher lastCommandCostMs than UNLINK of the same size', () => {
    const engineA = createEngine()
    engineA.execute(`RPUSH big ${Array.from({ length: 5000 }, (_, i) => i).join(' ')}`)
    engineA.execute('DEL big')
    const delCost = engineA.lastCommandCostMs

    const engineB = createEngine()
    engineB.execute(`RPUSH big ${Array.from({ length: 5000 }, (_, i) => i).join(' ')}`)
    engineB.execute('UNLINK big')
    const unlinkCost = engineB.lastCommandCostMs

    expect(delCost).toBeGreaterThan(unlinkCost)
  })

  it('LRANGE cost scales with the number of items actually returned', () => {
    const engine = createEngine()
    engine.execute(`RPUSH mylist ${Array.from({ length: 500 }, (_, i) => i).join(' ')}`)
    engine.execute('LRANGE mylist 0 4') // 5 items
    const smallCost = engine.lastCommandCostMs
    engine.execute('LRANGE mylist 0 -1') // 500 items
    const bigCost = engine.lastCommandCostMs
    expect(bigCost).toBeGreaterThan(smallCost)
  })

  it('FLUSHDB cost scales with the number of keys present before the flush', () => {
    const engine = createEngine()
    for (let i = 0; i < 200; i++) engine.execute(`SET k${i} v`)
    engine.execute('FLUSHDB')
    expect(engine.lastCommandCostMs).toBeGreaterThan(BASE_COST_MS)
  })
})
