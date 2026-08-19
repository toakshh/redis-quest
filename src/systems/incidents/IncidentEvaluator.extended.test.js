import { describe, it, expect } from 'vitest'
import { evaluatePredicate } from './IncidentEvaluator.js'
import { createEngine } from '../../engine/engine.js'

describe('streamLengthAbove', () => {
  it('true when the stream has more than min entries', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    engine.rawExecute('XADD', 's', '2-0', 'a', '2')
    expect(evaluatePredicate({ type: 'streamLengthAbove', key: 's', min: 1 }, engine)).toBe(true)
  })

  it('false when the stream does not exceed min', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    expect(evaluatePredicate({ type: 'streamLengthAbove', key: 's', min: 5 }, engine)).toBe(false)
  })

  it('does not throw on a missing key', () => {
    const engine = createEngine()
    expect(() =>
      evaluatePredicate({ type: 'streamLengthAbove', key: 'missing', min: 0 }, engine)
    ).not.toThrow()
  })
})

describe('streamLengthBelow', () => {
  it('true when the stream is below max', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    expect(evaluatePredicate({ type: 'streamLengthBelow', key: 's', max: 5 }, engine)).toBe(true)
  })

  it('false when the stream is at or above max', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    expect(evaluatePredicate({ type: 'streamLengthBelow', key: 's', max: 1 }, engine)).toBe(false)
  })

  it('missing key counts as length 0 and does not throw', () => {
    const engine = createEngine()
    expect(evaluatePredicate({ type: 'streamLengthBelow', key: 'missing', max: 1 }, engine)).toBe(true)
  })
})

describe('pendingCountBelow', () => {
  function seeded() {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 's', 'g', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'g', 'c1', 'STREAMS', 's', '>')
    return engine
  }

  it('true when pending count is below max', () => {
    const engine = seeded()
    expect(evaluatePredicate({ type: 'pendingCountBelow', key: 's', group: 'g', max: 5 }, engine)).toBe(true)
  })

  it('false when pending count meets or exceeds max', () => {
    const engine = seeded()
    expect(evaluatePredicate({ type: 'pendingCountBelow', key: 's', group: 'g', max: 1 }, engine)).toBe(false)
  })

  it('missing key/group does not throw and counts as 0 pending', () => {
    const engine = createEngine()
    expect(evaluatePredicate({ type: 'pendingCountBelow', key: 'missing', group: 'g', max: 1 }, engine)).toBe(true)
  })
})

describe('consumerGroupExists', () => {
  it('true when the group was created on the stream', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 's', 'workers', '0')
    expect(evaluatePredicate({ type: 'consumerGroupExists', key: 's', group: 'workers' }, engine)).toBe(true)
  })

  it('false when no such group exists', () => {
    const engine = createEngine()
    engine.rawExecute('XADD', 's', '1-0', 'a', '1')
    expect(evaluatePredicate({ type: 'consumerGroupExists', key: 's', group: 'ghost' }, engine)).toBe(false)
  })

  it('does not throw on a missing key', () => {
    const engine = createEngine()
    expect(() =>
      evaluatePredicate({ type: 'consumerGroupExists', key: 'missing', group: 'g' }, engine)
    ).not.toThrow()
  })
})

describe('hitRatioAbove', () => {
  it('true when the hit ratio exceeds min', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    engine.execute('GET k')
    expect(evaluatePredicate({ type: 'hitRatioAbove', min: 0.5 }, engine)).toBe(true)
  })

  it('false when the hit ratio does not exceed min', () => {
    const engine = createEngine()
    engine.execute('GET missing')
    expect(evaluatePredicate({ type: 'hitRatioAbove', min: 0.5 }, engine)).toBe(false)
  })

  it('does not throw on a fresh engine with no reads yet', () => {
    const engine = createEngine()
    expect(() => evaluatePredicate({ type: 'hitRatioAbove', min: 0.5 }, engine)).not.toThrow()
  })
})

describe('memoryBelowRatio', () => {
  it('true when memory usage is under the ratio', () => {
    const engine = createEngine({ memoryLimit: 1_000_000 })
    engine.execute('SET k v')
    expect(evaluatePredicate({ type: 'memoryBelowRatio', max: 0.9 }, engine)).toBe(true)
  })

  it('false when memory usage meets or exceeds the ratio', () => {
    const engine = createEngine({ memoryLimit: 10 })
    engine.execute('SET k v')
    expect(evaluatePredicate({ type: 'memoryBelowRatio', max: 0.1 }, engine)).toBe(false)
  })

  it('does not throw on a fresh engine', () => {
    const engine = createEngine()
    expect(() => evaluatePredicate({ type: 'memoryBelowRatio', max: 0.5 }, engine)).not.toThrow()
  })
})

describe('keyCountBelow', () => {
  it('true when the active db has fewer keys than max', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    expect(evaluatePredicate({ type: 'keyCountBelow', max: 5 }, engine)).toBe(true)
  })

  it('false when the active db has max or more keys', () => {
    const engine = createEngine()
    engine.execute('SET k1 v')
    engine.execute('SET k2 v')
    expect(evaluatePredicate({ type: 'keyCountBelow', max: 2 }, engine)).toBe(false)
  })

  it('does not throw on an empty store', () => {
    const engine = createEngine()
    expect(() => evaluatePredicate({ type: 'keyCountBelow', max: 5 }, engine)).not.toThrow()
  })
})

describe('allKeysHaveTtl', () => {
  it('true when every matching key has a TTL', () => {
    const engine = createEngine()
    engine.execute('SET session:1 v EX 60')
    engine.execute('SET session:2 v EX 60')
    expect(evaluatePredicate({ type: 'allKeysHaveTtl', pattern: 'session:*' }, engine)).toBe(true)
  })

  it('false when a matching key lacks a TTL', () => {
    const engine = createEngine()
    engine.execute('SET session:1 v EX 60')
    engine.execute('SET session:2 v')
    expect(evaluatePredicate({ type: 'allKeysHaveTtl', pattern: 'session:*' }, engine)).toBe(false)
  })

  it('vacuously true and does not throw when nothing matches the pattern', () => {
    const engine = createEngine()
    expect(evaluatePredicate({ type: 'allKeysHaveTtl', pattern: 'nomatch:*' }, engine)).toBe(true)
  })
})

describe('lockHeldWithFence', () => {
  it('true when the stored fence token is at or above minFence', () => {
    const engine = createEngine()
    engine.execute('SET lock:a 42')
    expect(evaluatePredicate({ type: 'lockHeldWithFence', key: 'lock:a', minFence: 10 }, engine)).toBe(true)
  })

  it('false when the stored fence token is below minFence', () => {
    const engine = createEngine()
    engine.execute('SET lock:a 3')
    expect(evaluatePredicate({ type: 'lockHeldWithFence', key: 'lock:a', minFence: 10 }, engine)).toBe(false)
  })

  it('does not throw on a missing key', () => {
    const engine = createEngine()
    expect(() =>
      evaluatePredicate({ type: 'lockHeldWithFence', key: 'missing', minFence: 1 }, engine)
    ).not.toThrow()
  })
})

describe('evictionCountBelow', () => {
  it('true when keysEvicted is below max', () => {
    const engine = createEngine()
    expect(evaluatePredicate({ type: 'evictionCountBelow', max: 5 }, engine)).toBe(true)
  })

  it('false once keysEvicted reaches max', () => {
    const engine = createEngine({ seed: 'iev-1', memoryLimit: 60 })
    engine.execute('CONFIG SET maxmemory-policy allkeys-random')
    engine.execute('SET k1 value')
    engine.execute('SET k2 value')
    engine.execute('SET k3 value')
    expect(evaluatePredicate({ type: 'evictionCountBelow', max: 0 }, engine)).toBe(false)
  })

  it('does not throw on a fresh engine', () => {
    const engine = createEngine()
    expect(() => evaluatePredicate({ type: 'evictionCountBelow', max: 1 }, engine)).not.toThrow()
  })
})
