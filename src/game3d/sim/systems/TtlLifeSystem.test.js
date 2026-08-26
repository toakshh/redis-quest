// Tests for TtlLifeSystem: the player-key TTL drives health, sampling is
// throttled, and expiry fires sim:playerExpired exactly once.

import { describe, it, expect } from 'vitest'
import { createTtlLifeSystem } from './TtlLifeSystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'

const DT = 1 / 60
const KEY = 'session:7742'

function makeWorld(opts) {
  let t = 0
  const runtime = createRuntime({ seed: 'ttl', now: () => t })
  const w = createSimWorld({ runtime, seed: 'ttl', clock: () => t })
  w.addSystem(createTtlLifeSystem(opts))
  return { w, setClock: (v) => { t = v } }
}

function stepN(w, n) {
  for (let i = 0; i < n; i++) w.step(DT)
}

describe('TtlLifeSystem', () => {
  it('registers at the TTL_LIFE order', () => {
    expect(createTtlLifeSystem().order).toBe(70)
  })

  it('maps a full TTL to health 1.0', () => {
    const { w } = makeWorld({ maxTtlMs: 60_000, intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    stepN(w, 6) // reaches tick 6 → first sample
    expect(w.playerHealth01).toBe(1)
  })

  it('maps a half-consumed TTL to ~0.5 health', () => {
    const { w, setClock } = makeWorld({ maxTtlMs: 60_000, intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    setClock(30_000)
    stepN(w, 6)
    expect(w.playerHealth01).toBeCloseTo(0.5, 2)
  })

  it('only samples every intervalTicks', () => {
    const { w } = makeWorld({ maxTtlMs: 60_000, intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    stepN(w, 5) // not yet at a sample tick
    expect(w.playerHealth01).toBeUndefined()
    stepN(w, 1) // tick 6
    expect(w.playerHealth01).toBe(1)
  })

  it('treats a persistent key (no expiry) as full health', () => {
    const { w } = makeWorld({ intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive`)
    stepN(w, 6)
    expect(w.playerTtlMs).toBe(-1)
    expect(w.playerHealth01).toBe(1)
  })

  it('fires sim:playerExpired once when the TTL runs out', () => {
    const { w, setClock } = makeWorld({ maxTtlMs: 60_000, intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    let fired = 0
    w.bus.on('sim:playerExpired', () => fired++)
    setClock(61_000)
    stepN(w, 12) // two sample ticks past expiry
    expect(w.playerHealth01).toBe(0)
    expect(fired).toBe(1)
  })

  it('re-arms the death latch if the player is revived', () => {
    const { w, setClock } = makeWorld({ maxTtlMs: 60_000, intervalTicks: 6 })
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    let fired = 0
    w.bus.on('sim:playerExpired', () => fired++)
    setClock(61_000)
    stepN(w, 6)
    expect(fired).toBe(1)
    // Revive: new key with fresh TTL, clock still 61s.
    w.engine.execute(`SET ${KEY} alive PX 60000`)
    stepN(w, 6)
    expect(w.playerHealth01).toBe(1)
    // Let it die again → should fire a second time.
    setClock(130_000)
    stepN(w, 6)
    expect(fired).toBe(2)
  })
})
