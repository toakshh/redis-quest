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

  it('emits a command event with name, args and reply for executed commands', () => {
    const engine = createEngine()
    const seen = []
    engine.on('command', (payload) => seen.push(payload))

    engine.execute('SET name "Ada"')
    expect(seen).toHaveLength(1)
    expect(seen[0].name).toBe('SET')
    expect(seen[0].args[0]).toBe('SET')
    expect(seen[0].args[1]).toBe('name')
    expect(seen[0].reply).toEqual({ type: 'simple', value: 'OK' })

    engine.rawExecute('GET', 'name')
    expect(seen[1].name).toBe('GET')
    expect(seen[1].reply).toEqual({ type: 'bulk', value: 'Ada' })
  })

  it('emits a command event even when the reply is an error (arity/syntax)', () => {
    const engine = createEngine()
    const seen = []
    engine.on('command', (p) => seen.push(p.name))
    engine.execute('GET')
    expect(seen).toContain('GET')
    const reply = engine.execute('NOTACOMMAND x')
    expect(reply.type).toBe('error')
    // unknown commands are not broadcast (no handler ran)
    expect(seen).not.toContain('NOTACOMMAND')
  })

  it('broadcasts queued MULTI commands when EXEC actually runs them', () => {
    const engine = createEngine()
    const seen = []
    engine.on('command', (p) => seen.push(p.name))
    engine.execute('MULTI') // broadcasts MULTI
    engine.execute('SET a 1') // queued: NOT broadcast yet
    expect(seen).toEqual(['MULTI'])
    engine.execute('EXEC') // runs the queue, so SET broadcasts at EXEC time
    expect(seen).toEqual(['MULTI', 'SET', 'EXEC'])
  })
})
