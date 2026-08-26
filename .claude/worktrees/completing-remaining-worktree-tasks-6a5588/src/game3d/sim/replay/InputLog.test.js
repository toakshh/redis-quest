// Tests for InputLog: recording, ordering, ring-buffer rollover, and
// serialize/deserialize round-trips.

import { describe, it, expect } from 'vitest'
import { createInputLog, INPUT_LOG_CAPACITY } from './InputLog.js'

describe('InputLog', () => {
  it('defaults to the 20,000-entry capacity', () => {
    expect(createInputLog().capacity).toBe(INPUT_LOG_CAPACITY)
    expect(INPUT_LOG_CAPACITY).toBe(20000)
  })

  it('records entries in chronological order', () => {
    const log = createInputLog({ capacity: 8 })
    log.record(1, { line: 'GET a' })
    log.record(2, { line: 'SET b 1' })
    expect(log.length).toBe(2)
    expect(log.entries()).toEqual([
      { tick: 1, intent: { line: 'GET a' } },
      { tick: 2, intent: { line: 'SET b 1' } },
    ])
  })

  it('rolls the oldest entries off once full', () => {
    const log = createInputLog({ capacity: 3 })
    for (let t = 1; t <= 5; t++) log.record(t, { line: `n${t}` })
    expect(log.length).toBe(3)
    expect(log.entries().map((e) => e.tick)).toEqual([3, 4, 5])
  })

  it('never grows beyond capacity across many records', () => {
    const log = createInputLog({ capacity: 100 })
    for (let t = 0; t < 100000; t++) log.record(t, { line: 'x' })
    expect(log.length).toBe(100)
    expect(log.entries()[0].tick).toBe(99900)
  })

  it('serialize/deserialize round-trips', () => {
    const log = createInputLog({ capacity: 4 })
    log.record(10, { line: 'DEL k', toolId: 'PURGE' })
    log.record(11, { line: 'GET k', toolId: 'PROBE' })
    const json = log.serialize()

    const restored = createInputLog({ capacity: 4 }).deserialize(json)
    expect(restored.entries()).toEqual(log.entries())
  })

  it('deserialize adopts the serialized capacity', () => {
    const log = createInputLog({ capacity: 2 })
    log.record(1, { line: 'a' })
    log.record(2, { line: 'b' })
    log.record(3, { line: 'c' }) // rolls off tick 1
    const json = log.serialize()
    const restored = createInputLog().deserialize(json)
    expect(restored.capacity).toBe(2)
    expect(restored.entries().map((e) => e.tick)).toEqual([2, 3])
  })

  it('clear empties the log', () => {
    const log = createInputLog({ capacity: 4 })
    log.record(1, { line: 'a' })
    log.clear()
    expect(log.length).toBe(0)
    expect(log.entries()).toEqual([])
  })
})
