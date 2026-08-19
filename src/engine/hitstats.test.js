import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'

describe('keyspace hit/miss statistics', () => {
  it('GET on a missing key records one miss and zero hits', () => {
    const engine = createEngine()
    engine.execute('GET missing')
    expect(engine.stats.keyspaceMisses).toBe(1)
    expect(engine.stats.keyspaceHits).toBe(0)
  })

  it('SET then GET records exactly one hit', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    engine.execute('GET k')
    expect(engine.stats.keyspaceHits).toBe(1)
    expect(engine.stats.keyspaceMisses).toBe(0)
  })

  it('SET alone records no hits and no misses', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    expect(engine.stats.keyspaceHits).toBe(0)
    expect(engine.stats.keyspaceMisses).toBe(0)
  })

  it('EXISTS on a missing key counts as a miss', () => {
    const engine = createEngine()
    engine.execute('EXISTS missing')
    expect(engine.stats.keyspaceMisses).toBe(1)
  })

  it('hitRatio() on a fresh engine returns 1', () => {
    const engine = createEngine()
    expect(engine.hitRatio()).toBe(1)
  })

  it('3 hits and 1 miss give a 0.75 hit ratio', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    engine.execute('GET k')
    engine.execute('GET k')
    engine.execute('GET k')
    engine.execute('GET missing')
    expect(engine.hitRatio()).toBe(0.75)
  })

  it('records outside the lookback window are excluded', () => {
    let t = 0
    const engine = createEngine({ now: () => t })
    engine.execute('SET k v')
    t = 0
    engine.execute('GET k') // hit at t=0
    t = 100000
    engine.execute('GET missing') // miss at t=100000
    // 30s window from t=100000 excludes the t=0 hit entirely
    expect(engine.hitRatio(30000)).toBe(0)
  })

  it('_hitWindow stays bounded after 3000 reads (trim runs once per command, before that command\'s own _get push, so steady state is 2001 for a single-GET workload)', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    for (let i = 0; i < 3000; i++) engine.execute('GET k')
    expect(engine._hitWindow.length).toBeLessThanOrEqual(2001)
  })

  it('INFO stats section reports the real hit/miss numbers', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    engine.execute('GET k')
    engine.execute('GET missing')
    const reply = engine.execute('INFO stats')
    expect(reply.value).toContain('keyspace_hits:1')
    expect(reply.value).toContain('keyspace_misses:1')
  })

  it('regression guard: 50 assorted write commands never register a miss', () => {
    const engine = createEngine()
    for (let i = 0; i < 50; i++) {
      engine.execute(`SET key:${i} value`)
    }
    expect(engine.stats.keyspaceMisses).toBe(0)
    expect(engine.stats.keyspaceHits).toBe(0)
  })
})
