// Tests for ReplayHarness: the run shape, tick count, determinism, seed
// divergence, and the ending/beats reporting.

import { describe, it, expect } from 'vitest'
import { runHeadless } from './ReplayHarness.js'
import { buildIntent, TOOLS } from '../redis/CommandIntent.js'

const KEY = 'session:7742'

describe('ReplayHarness', () => {
  it('returns { stateHash, beatsPlayed, ending, tick }', () => {
    const r = runHeadless({ seed: 's', inputs: [], ticks: 10 })
    expect(r).toHaveProperty('stateHash')
    expect(r).toHaveProperty('beatsPlayed')
    expect(r).toHaveProperty('ending')
    expect(r.tick).toBe(10)
  })

  it('is deterministic for the same seed and inputs', () => {
    const inputs = [{ tick: 3, intent: buildIntent(TOOLS.STORE, 'a', { value: '1' }) }]
    const a = runHeadless({ seed: 'same', inputs, ticks: 120 })
    const b = runHeadless({ seed: 'same', inputs, ticks: 120 })
    expect(a.stateHash).toBe(b.stateHash)
  })

  it('diverges on a different seed', () => {
    const a = runHeadless({ seed: 'seed-A', inputs: [], ticks: 60 })
    const c = runHeadless({ seed: 'seed-Z', inputs: [], ticks: 60 })
    expect(a.stateHash).not.toBe(c.stateHash)
  })

  it('reports ending "expired" when the player key is purged', () => {
    const inputs = [{ tick: 3, intent: buildIntent(TOOLS.PURGE, KEY) }]
    const r = runHeadless({ seed: 'die', inputs, ticks: 24 })
    expect(r.ending).toBe('expired')
  })

  it('reports ending "complete" and a beat when objectives pass', () => {
    const objectives = [{ id: 'stored', predicate: { type: 'keyExists', key: 'k' } }]
    const inputs = [{ tick: 2, intent: buildIntent(TOOLS.STORE, 'k', { value: '1' }) }]
    const r = runHeadless({ seed: 'win', inputs, ticks: 36, objectives })
    expect(r.ending).toBe('complete')
    expect(r.beatsPlayed).toBe(1)
  })

  it('accepts an InputLog-like source via entries()', () => {
    const source = {
      entries: () => [{ tick: 2, intent: buildIntent(TOOLS.TOLLGATE, 'c') }],
    }
    const r = runHeadless({ seed: 'log', inputs: source, ticks: 12 })
    expect(r.tick).toBe(12)
  })
})
