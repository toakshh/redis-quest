import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'
import { createEventBus } from './EventBus.js'
import { RedisGameBridge } from './RedisGameBridge.js'
import { EVENT_TYPES, EFFECT_KINDS } from './GameEvents.js'

function setup() {
  const engine = createEngine()
  const eventBus = createEventBus()
  const bridge = new RedisGameBridge({ engine, eventBus }).start()
  const events = []
  eventBus.on('*', (ev) => events.push(ev))
  return { engine, eventBus, bridge, events }
}

describe('RedisGameBridge', () => {
  it('emits RedisCommandExecuted for every command', () => {
    const { engine, events } = setup()
    engine.execute('SET name Ada')
    const executed = events.filter((e) => e.type === EVENT_TYPES.REDIS_COMMAND_EXECUTED)
    expect(executed).toHaveLength(1)
    expect(executed[0].payload.command).toBe('SET')
    expect(executed[0].payload.args).toEqual(['name', 'Ada'])
  })

  it('maps SET on a new key to crystal_form and reports a created key', () => {
    const { engine, events } = setup()
    engine.execute('SET name Ada')
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects).toHaveLength(1)
    expect(effects[0].payload.effect).toBe(EFFECT_KINDS.CRYSTAL_FORM)
    expect(effects[0].payload.key).toBe('name')

    const state = events.find((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)
    expect(state.payload.changes).toEqual([
      { key: 'name', type: 'created', entry: { type: 'string', value: 'Ada', expiresAt: null, version: 1 } },
    ])
  })

  it('refines an existing-key write to crystal_pulse', () => {
    const { engine, events } = setup()
    engine.execute('SET name Ada')
    events.length = 0
    engine.execute('SET name Grace')
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects[0].payload.effect).toBe(EFFECT_KINDS.CRYSTAL_PULSE)

    const state = events.find((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)
    expect(state.payload.changes).toEqual([
      { key: 'name', type: 'updated', entry: { type: 'string', value: 'Grace', expiresAt: null, version: 2 } },
    ])
  })

  it('emits a shatter effect and a deleted state change for DEL', () => {
    const { engine, events } = setup()
    engine.execute('SET name Ada')
    events.length = 0
    engine.execute('DEL name')
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects[0].payload.effect).toBe(EFFECT_KINDS.SHATTER)

    const state = events.find((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)
    expect(state.payload.changes).toEqual([{ key: 'name', type: 'deleted', entry: null }])
  })

  it('emits a red ripple for an erroring command and no state change', () => {
    const { engine, events } = setup()
    engine.execute('GET missing')
    events.length = 0
    engine.execute('GETSET nope') // wrong arity
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects).toHaveLength(1)
    expect(effects[0].payload.effect).toBe(EFFECT_KINDS.ERROR_RIPPLE)
    expect(events.some((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)).toBe(false)
  })

  it('skips effects for MULTI-queued commands', () => {
    const { engine, events } = setup()
    engine.execute('MULTI')
    events.length = 0
    engine.execute('SET name Ada')
    expect(events.some((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)).toBe(false)
    expect(events.some((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)).toBe(false)
  })

  it('collapses a MULTI/EXEC batch into one state change event', () => {
    const { engine, events } = setup()
    engine.execute('MULTI')
    engine.execute('SET a 1')
    engine.execute('SET b 2')
    events.length = 0
    engine.execute('EXEC')
    const state = events.filter((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)
    expect(state).toHaveLength(1)
    const keys = state[0].payload.changes.map((c) => c.key).sort()
    expect(keys).toEqual(['a', 'b'])
  })

  it('emits a poof effect and deleted change on key expiry', () => {
    const { engine, events, bridge } = setup()
    engine.execute('SET token abc EX 1')
    events.length = 0
    engine._now = () => Date.now() + 2000 // fast-forward past the TTL
    engine._sweepExpired()
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects.some((e) => e.payload.effect === EFFECT_KINDS.POOF)).toBe(true)
    const state = events.find((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)
    expect(state.payload.changes).toEqual([{ key: 'token', type: 'deleted', entry: null }])
    bridge.stop()
  })

  it('emits nothing for a guard-refused SET NX', () => {
    const { engine, events } = setup()
    engine.execute('SET name Ada')
    events.length = 0
    engine.execute('SET name Grace NX') // nil reply, no write
    expect(events.some((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)).toBe(false)
    expect(events.some((e) => e.type === EVENT_TYPES.REDIS_STATE_CHANGED)).toBe(false)
  })

  it('targets every key for MSET', () => {
    const { engine, events } = setup()
    engine.execute('MSET a 1 b 2')
    const effects = events.filter((e) => e.type === EVENT_TYPES.VISUAL_EFFECT_REQUESTED)
    expect(effects.map((e) => e.payload.key).sort()).toEqual(['a', 'b'])
  })
})
