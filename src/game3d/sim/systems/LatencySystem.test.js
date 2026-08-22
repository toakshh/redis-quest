// Tests for LatencySystem: the stall hitch on expensive commands and the p99
// estimate over the rolling command window.

import { describe, it, expect } from 'vitest'
import { createLatencySystem, STALL_THRESHOLD_MS } from './LatencySystem.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'

const DT = 1 / 60

function makeWorld() {
  let t = 1000
  const runtime = createRuntime({ seed: 'lat', now: () => t })
  const w = createSimWorld({ runtime, seed: 'lat', clock: () => t })
  w.addSystem(createLatencySystem())
  // Fire a command with a controlled cost, then advance one tick.
  function fire(costMs) {
    w.engine.execute('GET x') // bumps commandSeq
    w.engine.lastCommandCostMs = costMs // override with a deterministic cost
    w.step(DT)
  }
  return { w, fire, setClock: (v) => { t = v } }
}

describe('LatencySystem', () => {
  it('registers at the LATENCY order', () => {
    expect(createLatencySystem().order).toBe(90)
  })

  it('sets stallUntilMs when a command exceeds the threshold', () => {
    const { w, fire } = makeWorld()
    fire(STALL_THRESHOLD_MS + 12) // 20ms
    expect(w.stallUntilMs).toBe(1000 + 20)
  })

  it('does not stall for a cheap command', () => {
    const { w, fire } = makeWorld()
    fire(2)
    expect(w.stallUntilMs).toBeUndefined()
  })

  it('does not re-record on an idle tick', () => {
    const { w, fire } = makeWorld()
    fire(5)
    const p99After1 = w.latencyP99Ms
    w.step(DT) // no new command executed
    w.step(DT)
    expect(w.latencyP99Ms).toBe(p99After1) // unchanged
  })

  it('computes a p99 that tracks the slow tail', () => {
    const { w, fire } = makeWorld()
    for (let i = 0; i < 50; i++) fire(1)
    for (let i = 0; i < 50; i++) fire(20)
    expect(w.latencyP99Ms).toBeCloseTo(20, 6)
  })

  it('p99 equals the sample value when the window is uniform', () => {
    const { w, fire } = makeWorld()
    for (let i = 0; i < 10; i++) fire(7)
    expect(w.latencyP99Ms).toBeCloseTo(7, 6)
  })
})
