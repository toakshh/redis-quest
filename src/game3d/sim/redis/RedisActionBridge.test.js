// Tests for RedisActionBridge: intent execution, result publication, and the
// per-tick cap.

import { describe, it, expect } from 'vitest'
import { createRedisActionBridge, MAX_INTENTS_PER_TICK } from './RedisActionBridge.js'
import { buildIntent, TOOLS } from './CommandIntent.js'
import { createSimWorld } from '../SimWorld.js'
import { createRuntime } from '../../bootstrap.js'

function makeWorld() {
  const runtime = createRuntime({ seed: 'bridge', now: () => 0 })
  const w = createSimWorld({ runtime, seed: 'bridge', clock: () => 0 })
  const bridge = createRedisActionBridge()
  w.addSystem(bridge)
  return { w, bridge }
}

const DT = 1 / 60

describe('RedisActionBridge', () => {
  it('registers at the REDIS order', () => {
    expect(createRedisActionBridge().order).toBe(20)
  })

  it('executes a queued intent against the engine', () => {
    const { w, bridge } = makeWorld()
    bridge.enqueue(buildIntent(TOOLS.STORE, 'a', { value: '5' }))
    w.step(DT)
    expect(w.engine.execute('GET a').value).toBe('5')
  })

  it('publishes sim:commandResult with intent, reply, and costMs', () => {
    const { w, bridge } = makeWorld()
    const results = []
    w.bus.on('sim:commandResult', (p) => results.push(p))
    const intent = buildIntent(TOOLS.STORE, 'k', { value: '1' })
    bridge.enqueue(intent)
    w.step(DT)
    expect(results).toHaveLength(1)
    expect(results[0].intent).toBe(intent)
    expect(results[0].reply.value).toBe('OK')
    expect(typeof results[0].costMs).toBe('number')
  })

  it('drains the queue so intents are not re-executed', () => {
    const { w, bridge } = makeWorld()
    bridge.enqueue(buildIntent(TOOLS.TOLLGATE, 'c'))
    w.step(DT)
    w.step(DT)
    expect(w.engine.execute('GET c').value).toBe('1') // INCR ran exactly once
  })

  it('processes at most MAX_INTENTS_PER_TICK per tick', () => {
    const { w, bridge } = makeWorld()
    for (let i = 0; i < MAX_INTENTS_PER_TICK + 4; i++) {
      bridge.enqueue(buildIntent(TOOLS.TOLLGATE, 'counter'))
    }
    w.step(DT)
    expect(Number(w.engine.execute('GET counter').value)).toBe(MAX_INTENTS_PER_TICK)
    expect(bridge.queue.length).toBe(4)
    w.step(DT)
    expect(Number(w.engine.execute('GET counter').value)).toBe(MAX_INTENTS_PER_TICK + 4)
  })

  it('flush returns the number of intents processed', () => {
    const { w, bridge } = makeWorld()
    bridge.enqueue(buildIntent(TOOLS.TOLLGATE, 'x'))
    bridge.enqueue(buildIntent(TOOLS.TOLLGATE, 'x'))
    expect(bridge.flush(w)).toBe(2)
    expect(bridge.flush(w)).toBe(0)
  })
})
