// Tests for the SimWorld skeleton: fixed-step ticking, ordered system
// execution, timeScale, snapshot/restore, and deterministic state hashing.

import { describe, it, expect } from 'vitest'
import { createSimWorld, SYSTEM_ORDER } from './SimWorld.js'
import { createRuntime } from '../bootstrap.js'

function makeWorld(seed = 'sim-test') {
  const runtime = createRuntime({ seed, now: () => 0 })
  return createSimWorld({ runtime, seed, clock: () => 0 })
}

describe('SimWorld', () => {
  it('exposes the runtime engine, bus, and rng', () => {
    const runtime = createRuntime({ seed: 'x', now: () => 0 })
    const w = createSimWorld({ runtime, seed: 'x', clock: () => 0 })
    expect(w.engine).toBe(runtime.engine)
    expect(w.bus).toBe(runtime.bus)
    expect(w.rng).toBe(runtime.rng)
  })

  it('starts at tick 0 with an empty entity store', () => {
    const w = makeWorld()
    expect(w.tick).toBe(0)
    expect(w.entities.count).toBe(0)
  })

  it('advances tick to 100 after 100 steps', () => {
    const w = makeWorld()
    for (let i = 0; i < 100; i++) w.step(1 / 60)
    expect(w.tick).toBe(100)
  })

  it('accumulates simulated time', () => {
    const w = makeWorld()
    w.step(1 / 60)
    w.step(1 / 60)
    expect(w.timeMs).toBeCloseTo((2000) / 60, 6)
  })

  it('exposes frozen SYSTEM_ORDER constants', () => {
    expect(SYSTEM_ORDER.INPUT).toBe(10)
    expect(SYSTEM_ORDER.OBJECTIVE).toBe(100)
    expect(SYSTEM_ORDER.TEACHING).toBe(130)
    expect(Object.isFrozen(SYSTEM_ORDER)).toBe(true)
  })

  it('runs systems in ascending order regardless of insertion order', () => {
    const w = makeWorld()
    const seen = []
    w.addSystem({ name: 'c', order: 130, update: () => seen.push('c') })
    w.addSystem({ name: 'a', order: 10, update: () => seen.push('a') })
    w.addSystem({ name: 'b', order: 60, update: () => seen.push('b') })
    w.step(1 / 60)
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('passes the fixed dt to systems at timeScale 1', () => {
    const w = makeWorld()
    let seenDt = null
    w.addSystem({ name: 's', order: 10, update: (_w, dt) => { seenDt = dt } })
    w.step(1 / 60)
    expect(seenDt).toBeCloseTo(1 / 60, 9)
  })

  it('timeScale = 0.5 halves the dt seen by systems but still advances one tick', () => {
    const w = makeWorld()
    w.timeScale = 0.5
    let seenDt = null
    w.addSystem({ name: 's', order: 10, update: (_w, dt) => { seenDt = dt } })
    w.step(1 / 60)
    expect(seenDt).toBeCloseTo(1 / 120, 9)
    expect(w.tick).toBe(1)
  })

  it('stateHash is stable across two identical runs and differs when an entity moves', () => {
    const a = makeWorld('seed-A')
    const b = makeWorld('seed-A')
    a.entities.spawn(0, 1, 0, 1)
    b.entities.spawn(0, 1, 0, 1)
    a.step(1 / 60)
    b.step(1 / 60)
    expect(a.stateHash()).toBe(b.stateHash())
    a.entities.posX[0] = 5
    expect(a.stateHash()).not.toBe(b.stateHash())
  })

  it('snapshot/restore round-trips the sim state and reproduces the hash', () => {
    const w = makeWorld('snap')
    const id = w.entities.spawn(3, 2.5, 0, -1.25)
    w.entities.health[id] = 0.7
    w.step(1 / 60)
    const before = w.stateHash()
    const snap = JSON.parse(JSON.stringify(w.snapshot()))

    // Mutate, then restore — the hash must return to its snapshotted value.
    w.entities.posX[id] = 999
    w.step(1 / 60)
    expect(w.stateHash()).not.toBe(before)
    w.restore(snap)
    expect(w.stateHash()).toBe(before)
    expect(w.tick).toBe(1)
  })
})
