import { describe, it, expect } from 'vitest'
import { createRuntime } from './bootstrap.js'

describe('createRuntime', () => {
  it('creates a fresh engine per call — two runtimes never share an engine object', () => {
    const a = createRuntime()
    const b = createRuntime()
    expect(a.engine).not.toBe(b.engine)
  })

  it('isolates keyspaces: a write in runtime A is invisible in runtime B', () => {
    const a = createRuntime()
    const b = createRuntime()
    a.engine.rawExecute('SET', 'k', '1')
    const reply = b.engine.rawExecute('GET', 'k')
    expect(reply.type).toBe('nil')
  })

  it('reproduces the same rng sequence for the same seed', () => {
    const a = createRuntime({ seed: 'abc' })
    const b = createRuntime({ seed: 'abc' })
    expect(a.rng()).toBe(b.rng())
  })

  it('republishes an engine command as redis:command on the bus', () => {
    const runtime = createRuntime({ seed: 'x' })
    const seen = []
    runtime.bus.on('redis:command', (evt) => seen.push(evt))
    runtime.engine.rawExecute('SET', 'foo', 'bar')
    expect(seen.length).toBe(1)
    expect(seen[0].name).toBe('SET')
  })

  it('dispose() stops further bus events from that engine', () => {
    const runtime = createRuntime({ seed: 'x' })
    const seen = []
    runtime.bus.on('redis:command', (evt) => seen.push(evt))
    runtime.dispose()
    runtime.engine.rawExecute('SET', 'foo', 'bar')
    expect(seen.length).toBe(0)
  })

  it('returns a frozen object', () => {
    const runtime = createRuntime()
    expect(Object.isFrozen(runtime)).toBe(true)
  })
})
