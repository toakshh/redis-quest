// End-to-end checks tying together the Phase 1 engine capabilities (streams,
// eviction, hit/miss stats, latency) the way a real 3D encounter will use
// them — not just each piece in isolation.

import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'

describe('Phase 1 integration', () => {
  it('eviction: 5000 keys under a lowered memory limit converge under allkeys-lru', () => {
    const engine = createEngine({ seed: 'phase1-evict' })
    engine.execute('CONFIG SET maxmemory-policy allkeys-lru')
    for (let i = 0; i < 5000; i++) {
      engine.execute(`SET key:${i} value`)
    }
    engine.memoryLimit = 50_000

    // maybeEvict() runs after every command and is capped at 200 evictions
    // per call (a safety bound, not a bug — see eviction.js), so bringing a
    // deeply over-budget keyspace under the limit takes multiple commands,
    // exactly as it would across a real play session's many ticks.
    let guard = 0
    while (engine.memoryBytes > engine.memoryLimit && guard < 100) {
      engine.execute(`SET trigger:${guard} value`)
      guard++
    }

    expect(engine.stats.keysEvicted).toBeGreaterThan(0)
    expect(engine.memoryBytes).toBeLessThanOrEqual(engine.memoryLimit)
  })

  it('streams: a full producer/consumer cycle — 100 produced, 100 delivered, 50 acked, 50 pending', () => {
    const engine = createEngine()

    for (let i = 0; i < 100; i++) {
      engine.execute(`XADD jobs * n ${i}`)
    }
    expect(engine.execute('XLEN jobs').value).toBe(100)

    engine.execute('XGROUP CREATE jobs workers 0')
    const delivered = engine.execute('XREADGROUP GROUP workers c1 COUNT 100 STREAMS jobs >')
    expect(delivered.value[0].value[1].value.length).toBe(100)

    const pendingBefore = engine.execute('XPENDING jobs workers')
    expect(pendingBefore.value[0].value).toBe(100)

    // Ack the first 50 delivered entries.
    const ids = delivered.value[0].value[1].value.slice(0, 50).map((e) => e.value[0].value)
    const acked = engine.execute(`XACK jobs workers ${ids.join(' ')}`)
    expect(acked.value).toBe(50)

    const pendingAfter = engine.execute('XPENDING jobs workers')
    expect(pendingAfter.value[0].value).toBe(50)
  })
})
