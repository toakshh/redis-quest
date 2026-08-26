// Tests for MemoryPressureSystem: pressure ratio, clamping, and Evictor speed.

import { describe, it, expect } from 'vitest'
import { createMemoryPressureSystem } from './MemoryPressureSystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'

const DT = 1 / 60

function makeWorld(memoryLimit) {
  const runtime = createRuntime({ seed: 'mem', memoryLimit, now: () => 0 })
  const w = createSimWorld({ runtime, seed: 'mem', clock: () => 0 })
  w.addSystem(createMemoryPressureSystem())
  return w
}

describe('MemoryPressureSystem', () => {
  it('registers at the MEMORY_PRESSURE order', () => {
    expect(createMemoryPressureSystem().order).toBe(80)
  })

  it('reports ~0 pressure and base Evictor speed on an empty store', () => {
    const w = makeWorld(1_000_000)
    w.step(DT)
    expect(w.memoryPressure).toBeGreaterThanOrEqual(0)
    expect(w.memoryPressure).toBeLessThan(0.05)
    expect(w.evictorSpeed).toBeCloseTo(0.6, 2)
  })

  it('pressure rises as the store fills', () => {
    const w = makeWorld(1_000_000)
    w.step(DT)
    const empty = w.memoryPressure
    for (let i = 0; i < 200; i++) w.engine.execute(`SET k:${i} ${'x'.repeat(50)}`)
    w.step(DT)
    expect(w.memoryPressure).toBeGreaterThan(empty)
  })

  it('clamps pressure to 1 and speed to 2.0 when bytes exceed the limit', () => {
    const w = makeWorld(1_000_000)
    for (let i = 0; i < 100; i++) w.engine.execute(`SET k:${i} ${'x'.repeat(100)}`)
    // Shrink the limit below what is already stored → ratio > 1, must clamp.
    w.engine.memoryLimit = 16
    w.step(DT)
    expect(w.memoryPressure).toBe(1)
    expect(w.evictorSpeed).toBeCloseTo(2.0, 6)
  })

  it('drives Evictor speed by the 0.6 + 1.4 * pressure formula', () => {
    const w = makeWorld(1_000_000)
    w.step(DT)
    expect(w.evictorSpeed).toBeCloseTo(0.6 + 1.4 * w.memoryPressure, 6)
  })
})
