import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'
import { pickEvictionCandidate, runEvictionPass, EVICTION_POLICIES } from './eviction.js'

describe('maxmemory-policy configuration', () => {
  it('defaults to noeviction', () => {
    const engine = createEngine()
    expect(engine.maxmemoryPolicy).toBe('noeviction')
  })

  it('CONFIG SET accepts every policy name in EVICTION_POLICIES', () => {
    const engine = createEngine()
    for (const policy of EVICTION_POLICIES) {
      const reply = engine.execute(`CONFIG SET maxmemory-policy ${policy}`)
      expect(reply.type).toBe('simple')
      expect(engine.maxmemoryPolicy).toBe(policy)
    }
  })

  it('CONFIG SET rejects an invalid policy name', () => {
    const engine = createEngine()
    const reply = engine.execute('CONFIG SET maxmemory-policy bogus-policy')
    expect(reply.type).toBe('error')
    expect(engine.maxmemoryPolicy).toBe('noeviction')
  })

  it('CONFIG GET reflects a prior CONFIG SET', () => {
    const engine = createEngine()
    engine.execute('CONFIG SET maxmemory-policy allkeys-lru')
    const reply = engine.execute('CONFIG GET maxmemory-policy')
    const pair = reply.value.find((r) => r.value[0].value === 'maxmemory-policy')
    expect(pair.value[1].value).toBe('allkeys-lru')
  })
})

describe('pickEvictionCandidate', () => {
  it('returns null under noeviction', () => {
    const engine = createEngine()
    engine.rawExecute('SET', 'k', 'v')
    expect(pickEvictionCandidate(engine, 'noeviction')).toBeNull()
  })

  it('returns null when the store is empty', () => {
    const engine = createEngine()
    expect(pickEvictionCandidate(engine, 'allkeys-random')).toBeNull()
  })

  it('returns null for volatile-* when no key has a TTL', () => {
    const engine = createEngine()
    engine.rawExecute('SET', 'k', 'v')
    expect(pickEvictionCandidate(engine, 'volatile-lru')).toBeNull()
  })

  it('allkeys-lru picks the smallest lruTick among the sample', () => {
    const engine = createEngine({ seed: 'evict-1' })
    // 5 keys == EVICTION_SAMPLE_SIZE, so the sample is deterministically
    // the whole set regardless of the rng draw.
    for (let i = 0; i < 5; i++) engine.rawExecute('SET', `k${i}`, 'v')
    const candidate = pickEvictionCandidate(engine, 'allkeys-lru')
    expect(candidate).toBe('k0') // created first -> smallest lruTick
  })

  it('volatile-ttl picks the soonest expiry among the sample', () => {
    const engine = createEngine({ seed: 'evict-2' })
    engine.rawExecute('SET', 'a', 'v')
    engine.rawExecute('PEXPIRE', 'a', '5000')
    engine.rawExecute('SET', 'b', 'v')
    engine.rawExecute('PEXPIRE', 'b', '1000')
    engine.rawExecute('SET', 'c', 'v')
    engine.rawExecute('PEXPIRE', 'c', '9000')
    const candidate = pickEvictionCandidate(engine, 'volatile-ttl')
    expect(candidate).toBe('b') // soonest expiresAt
  })

  it('volatile-random only ever samples keys that carry a TTL', () => {
    const engine = createEngine({ seed: 'evict-3' })
    const ttlKeys = ['t1', 't2']
    const noTtlKeys = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6']
    for (const k of ttlKeys) {
      engine.rawExecute('SET', k, 'v')
      engine.rawExecute('EXPIRE', k, '100')
    }
    for (const k of noTtlKeys) engine.rawExecute('SET', k, 'v')

    for (let i = 0; i < 20; i++) {
      const candidate = pickEvictionCandidate(engine, 'volatile-random')
      expect(ttlKeys).toContain(candidate)
      expect(noTtlKeys).not.toContain(candidate)
    }
  })
})

describe('runEvictionPass', () => {
  it('noeviction returns an empty result and evicts nothing', () => {
    const engine = createEngine({ memoryLimit: 10 })
    engine.rawExecute('SET', 'k', 'v')
    const result = runEvictionPass(engine, 'noeviction')
    expect(result).toEqual({ keys: [], freedBytes: 0, policy: 'noeviction' })
    expect(engine.memoryBytes).toBeGreaterThan(engine.memoryLimit)
  })

  it('stops once memoryBytes is at or under memoryLimit', () => {
    const engine = createEngine({ seed: 'evict-4' })
    for (let i = 0; i < 20; i++) engine.rawExecute('SET', `k${i}`, 'value')
    engine.memoryLimit = 100
    runEvictionPass(engine, 'allkeys-random')
    expect(engine.memoryBytes).toBeLessThanOrEqual(engine.memoryLimit)
  })
})

describe('maybeEvict (wired through the engine)', () => {
  it('noeviction never evicts even when memory exceeds the limit', () => {
    const engine = createEngine({ seed: 'evict-5', memoryLimit: 50 })
    engine.execute('SET k1 value')
    engine.execute('SET k2 value')
    expect(engine.stats.keysEvicted).toBe(0)
    expect(engine.memoryBytes).toBeGreaterThan(engine.memoryLimit)
  })

  it("emits 'evicted' with the right keys and a positive freedBytes", () => {
    const engine = createEngine({ seed: 'evict-6', memoryLimit: 60 })
    engine.execute('CONFIG SET maxmemory-policy allkeys-random')
    const events = []
    engine.on('evicted', (payload) => events.push(payload))
    engine.execute('SET k1 value')
    engine.execute('SET k2 value')
    engine.execute('SET k3 value')
    expect(events.length).toBeGreaterThan(0)
    const evt = events[0]
    expect(Array.isArray(evt.keys)).toBe(true)
    expect(evt.keys.length).toBeGreaterThan(0)
    expect(evt.freedBytes).toBeGreaterThan(0)
    expect(evt.policy).toBe('allkeys-random')
  })

  it('increments stats.keysEvicted by the number of evicted keys', () => {
    const engine = createEngine({ seed: 'evict-7', memoryLimit: 60 })
    engine.execute('CONFIG SET maxmemory-policy allkeys-random')
    engine.execute('SET k1 value')
    engine.execute('SET k2 value')
    engine.execute('SET k3 value')
    expect(engine.stats.keysEvicted).toBeGreaterThan(0)
  })

  it('a seeded engine evicts the same key deterministically across two identical runs', () => {
    function run() {
      const engine = createEngine({ seed: 'evict-deterministic', memoryLimit: 60 })
      engine.execute('CONFIG SET maxmemory-policy allkeys-lru')
      const evicted = []
      engine.on('evicted', (payload) => evicted.push(...payload.keys))
      engine.execute('SET k1 value')
      engine.execute('SET k2 value')
      engine.execute('SET k3 value')
      return evicted
    }
    expect(run()).toEqual(run())
  })
})
