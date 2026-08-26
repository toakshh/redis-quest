import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'

describe('stream snapshot/restore round-trip', () => {
  it('200 entries survive a snapshot/restore into a fresh engine — XLEN matches', () => {
    const engine = createEngine()
    for (let i = 1; i <= 200; i++) {
      engine.rawExecute('XADD', 'orders', `${i}-0`, 'n', String(i))
    }
    const snap = engine.snapshot()

    const restored = createEngine()
    restored.restore(snap)

    expect(restored.rawExecute('XLEN', 'orders').value).toBe(200)
  })

  it('entry content, ids and field data survive the round-trip', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 'orders', '1-0', 'item', 'widget', 'qty', '3')
    const snap = engine.snapshot()

    const restored = createEngine()
    restored.restore(snap)

    const reply = restored.rawExecute('XRANGE', 'orders', '-', '+')
    expect(reply.value[0].value[0].value).toBe('1-0')
    expect(reply.value[0].value[1].value.map((r) => r.value)).toEqual(['item', 'widget', 'qty', '3'])
  })

  it('further XADDs after restore continue the id sequence correctly', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 'orders', '5-0', 'a', '1')
    const snap = engine.snapshot()

    const restored = createEngine({ now: () => 5 })
    restored.restore(snap)
    const nextId = restored.rawExecute('XADD', 'orders', '5-*', 'a', '2')
    expect(nextId.value).toBe('5-1')
  })

  it('consumer groups, PEL, and delivery counts survive the round-trip', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const snap = engine.snapshot()

    const restored = createEngine()
    restored.restore(snap)

    const pending = restored.rawExecute('XPENDING', 'orders', 'workers')
    expect(pending.value[0].value).toBe(1)

    const acked = restored.rawExecute('XACK', 'orders', 'workers', '1-0')
    expect(acked.value).toBe(1)
  })
})
