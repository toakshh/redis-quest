import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MockRedisEngine } from '../../engine/engine.js'
import { EventBus } from '../../engine/EventBus.js'
import {
  WorldStateResolver,
  resolveGateState,
  resolveShieldState,
  resolveQueueState,
  resolveLeaderboardState,
  resolveWorldState,
} from './WorldStateResolver.js'
import { ConsequenceEngine } from './ConsequenceEngine.js'

describe('WorldStateResolver', () => {
  let engine

  beforeEach(() => {
    engine = new MockRedisEngine()
  })

  describe('resolveGateState', () => {
    it('returns default locked state when key is missing', () => {
      const gate = resolveGateState(engine, 'api:gate:mode')
      expect(gate.mode).toBe('locked')
      expect(gate.isLocked).toBe(true)
      expect(gate.isOpen).toBe(false)
      expect(gate.exists).toBe(false)
    })

    it('resolves string gate state correctly', () => {
      engine.execute('SET api:gate:mode locked')
      let gate = resolveGateState(engine, 'api:gate:mode')
      expect(gate.mode).toBe('locked')
      expect(gate.isLocked).toBe(true)
      expect(gate.isOpen).toBe(false)
      expect(gate.exists).toBe(true)

      engine.execute('SET api:gate:mode unlocked')
      gate = resolveGateState(engine, 'api:gate:mode')
      expect(gate.mode).toBe('unlocked')
      expect(gate.isLocked).toBe(false)
      expect(gate.isOpen).toBe(true)
    })

    it('resolves set gate state correctly', () => {
      engine.execute('SADD ward:gate key1 key2')
      const gate = resolveGateState(engine, 'ward:gate')
      expect(gate.isOpen).toBe(true)
      expect(gate.isLocked).toBe(false)
      expect(gate.members).toEqual(expect.arrayContaining(['key1', 'key2']))
    })
  })

  describe('resolveShieldState', () => {
    it('returns inactive state when key is missing', () => {
      const shield = resolveShieldState(engine, 'shield:status')
      expect(shield.active).toBe(false)
      expect(shield.power).toBe(0)
      expect(shield.status).toBe('inactive')
    })

    it('resolves string status and numeric power', () => {
      engine.execute('SET shield:status active')
      let shield = resolveShieldState(engine, 'shield:status')
      expect(shield.active).toBe(true)
      expect(shield.status).toBe('active')

      engine.execute('SET shield:power 75')
      shield = resolveShieldState(engine, 'shield:power')
      expect(shield.active).toBe(true)
      expect(shield.power).toBe(75)

      engine.execute('SET shield:power 0')
      shield = resolveShieldState(engine, 'shield:power')
      expect(shield.active).toBe(false)
      expect(shield.power).toBe(0)
    })

    it('resolves hash shield configuration', () => {
      engine.execute('HSET shield:config status active power 90')
      const shield = resolveShieldState(engine, 'shield:config')
      expect(shield.active).toBe(true)
      expect(shield.power).toBe(90)
      expect(shield.status).toBe('active')
    })
  })

  describe('resolveQueueState', () => {
    it('returns empty queue when list missing', () => {
      const queue = resolveQueueState(engine, 'task:queue')
      expect(queue.isEmpty).toBe(true)
      expect(queue.length).toBe(0)
      expect(queue.head).toBeNull()
      expect(queue.tail).toBeNull()
    })

    it('resolves list items and length', () => {
      engine.execute('RPUSH task:queue item1 item2 item3')
      const queue = resolveQueueState(engine, 'task:queue')
      expect(queue.isEmpty).toBe(false)
      expect(queue.length).toBe(3)
      expect(queue.head).toBe('item1')
      expect(queue.tail).toBe('item3')
      expect(queue.items).toEqual(['item1', 'item2', 'item3'])
    })
  })

  describe('resolveLeaderboardState', () => {
    it('resolves sorted set entries', () => {
      engine.execute('ZADD leaderboard 100 alice 200 bob 150 charlie')
      const lb = resolveLeaderboardState(engine, 'leaderboard')
      expect(lb.isEmpty).toBe(false)
      expect(lb.count).toBe(3)
      expect(lb.top[0]).toEqual({ member: 'alice', score: 100 })
    })
  })

  describe('resolveWorldState', () => {
    it('combines state resolvers into full world state snapshot', () => {
      engine.execute('SET api:gate:mode unlocked')
      engine.execute('SET shield:status active')
      engine.execute('RPUSH task:queue job1')

      const world = resolveWorldState(engine)
      expect(world.gate.isOpen).toBe(true)
      expect(world.shield.active).toBe(true)
      expect(world.queue.length).toBe(1)
      expect(world.timestamp).toBeGreaterThan(0)
    })

    it('works via WorldStateResolver instance', () => {
      const resolver = new WorldStateResolver(engine)
      engine.execute('SET api:gate:mode locked')
      const world = resolver.resolveWorldState()
      expect(world.gate.isLocked).toBe(true)
    })
  })
})

describe('ConsequenceEngine', () => {
  let engine
  let eventBus
  let consequenceEngine

  beforeEach(() => {
    engine = new MockRedisEngine()
    eventBus = new EventBus()
    consequenceEngine = new ConsequenceEngine({ engine, eventBus })
  })

  it('subscribes to Redis engine mutations and triggers gate lock consequence', () => {
    const callback = vi.fn()
    consequenceEngine.on('gate:locked', callback)

    engine.execute('SET api:gate:mode locked')

    expect(callback).toHaveBeenCalledTimes(1)
    const consequence = callback.mock.calls[0][0]
    expect(consequence.eventType).toBe('gate:locked')
    expect(consequence.payload.gate.isLocked).toBe(true)
    expect(consequence.payload.effect).toBe('gate_lock_effect')
  })

  it('triggers gate unlock consequence when mode changes to open/unlocked', () => {
    engine.execute('SET api:gate:mode locked')

    const callback = vi.fn()
    consequenceEngine.on('gate:unlocked', callback)

    engine.execute('SET api:gate:mode unlocked')

    expect(callback).toHaveBeenCalledTimes(1)
    const consequence = callback.mock.calls[0][0]
    expect(consequence.eventType).toBe('gate:unlocked')
    expect(consequence.payload.gate.isOpen).toBe(true)
  })

  it('dispatches consequences via EventBus', () => {
    const busListener = vi.fn()
    eventBus.on('gate:locked', busListener)

    engine.execute('SET api:gate:mode locked')

    expect(busListener).toHaveBeenCalledTimes(1)
    const eventArg = busListener.mock.calls[0][0]
    const ruleId = eventArg.ruleId || (eventArg.payload && eventArg.payload.ruleId)
    expect(ruleId).toBe('gate-lock')
  })

  it('triggers shield deactivated consequence when shield power goes off', () => {
    engine.execute('SET shield:status active')

    const callback = vi.fn()
    consequenceEngine.on('shield:deactivated', callback)

    engine.execute('SET shield:status inactive')

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].payload.state).toBe('deactivated')
  })

  it('triggers queue overflow consequence when queue exceeds threshold', () => {
    const callback = vi.fn()
    consequenceEngine.on('queue:overflow', callback)

    engine.execute('RPUSH task:queue a b c d e')

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].payload.queue.length).toBe(5)
  })

  it('allows adding and evaluating custom consequence rules', () => {
    const customListener = vi.fn()
    consequenceEngine.on('custom:alert', customListener)

    consequenceEngine.addRule({
      id: 'custom-alarm',
      eventType: 'custom:alert',
      keyPattern: 'alarm:level',
      condition: (ctx, current) => current.gate.isLocked,
      getPayload: () => ({ alert: 'RED' }),
    })

    engine.execute('SET api:gate:mode locked')

    expect(customListener).toHaveBeenCalled()
    expect(customListener.mock.calls[0][0].payload.alert).toBe('RED')
  })

  it('records history of triggered consequences', () => {
    engine.execute('SET api:gate:mode locked')
    engine.execute('SET api:gate:mode unlocked')

    const history = consequenceEngine.getHistory()
    expect(history.length).toBe(2)
    expect(history[0].eventType).toBe('gate:locked')
    expect(history[1].eventType).toBe('gate:unlocked')
  })

  it('detaches cleanly from Redis engine', () => {
    const callback = vi.fn()
    consequenceEngine.onConsequence(callback)

    consequenceEngine.detachEngine()
    engine.execute('SET api:gate:mode locked')

    expect(callback).not.toHaveBeenCalled()
  })
})
