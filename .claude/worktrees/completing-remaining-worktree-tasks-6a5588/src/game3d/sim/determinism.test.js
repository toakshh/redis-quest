import { describe, it, expect } from 'vitest'
import { runHeadless } from './replay/ReplayHarness.js'
import { buildIntent, TOOLS } from './redis/CommandIntent.js'
import { BUDGETS } from '../config/budgets.js'

// Generate a fixture of random-looking but deterministic inputs to simulate
// a 60-second realistic run (3600 ticks).
const FIXTURE = []
let t = 10
while (t < 3600) {
  FIXTURE.push({ tick: t, intent: buildIntent(TOOLS.STORE, `k${t}`, { value: '1' }) })
  t += 30 + (t % 15) // pseudo-random tick spacing
}

// PHASE 2 GATE — the keystone test
describe('Phase 2 GATE: Determinism & Performance', () => {
  it('reproduces an identical run from the same seed and input log', () => {
    const a = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
    const b = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
    expect(a.stateHash).toBe(b.stateHash)
  })

  it('diverges on a different seed', () => {
    const a = runHeadless({ seed: 'gate-1337', inputs: FIXTURE, ticks: 3600 })
    const c = runHeadless({ seed: 'gate-9999', inputs: FIXTURE, ticks: 3600 })
    expect(a.stateHash).not.toBe(c.stateHash)
  })

  it('runs 3600 ticks inside the sim budget', () => {
    const t0 = process.hrtime.bigint()
    runHeadless({ seed: 'perf', inputs: FIXTURE, ticks: 3600, entities: 400 })
    const msPerTick = Number(process.hrtime.bigint() - t0) / 1e6 / 3600
    // Perf is critical. It must take less than the total frame sim step budget.
    expect(msPerTick).toBeLessThan(BUDGETS.frame.simStepMs)
  })
})
