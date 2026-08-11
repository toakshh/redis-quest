import { describe, it, expect } from 'vitest'
import { MockRedisEngine, createEngine } from './engine.js'

describe('MockRedisEngine', () => {
  it('sets and gets string values', () => {
    const engine = createEngine()
    expect(engine.execute('SET name "Ada Lovelace"')).toEqual({ type: 'simple', value: 'OK' })
    expect(engine.execute('GET name')).toEqual({ type: 'bulk', value: 'Ada Lovelace' })
  })

  it('increments integer values with rawExecute', () => {
    const engine = new MockRedisEngine()
    engine.rawExecute('SET', 'counter', '10')
    expect(engine.rawExecute('INCR', 'counter')).toEqual({ type: 'integer', value: 11 })
    expect(engine.execute('GET counter')).toEqual({ type: 'bulk', value: '11' })
  })

  it('returns an error for unknown commands', () => {
    const engine = createEngine()
    const reply = engine.execute('NOPE wat')
    expect(reply.type).toBe('error')
    expect(reply.value).toContain("unknown command 'NOPE'")
  })
})
