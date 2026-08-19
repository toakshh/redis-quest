import { describe, it, expect } from 'vitest'
import { createEngine } from '../engine.js'

describe('SETNX', () => {
  it('sets a missing key and returns 1', () => {
    const engine = createEngine()
    const reply = engine.execute('SETNX lock held')
    expect(reply).toEqual({ type: 'integer', value: 1 })
    expect(engine.execute('GET lock').value).toBe('held')
  })

  it('does nothing on an existing key and returns 0', () => {
    const engine = createEngine()
    engine.execute('SET lock first')
    const reply = engine.execute('SETNX lock second')
    expect(reply).toEqual({ type: 'integer', value: 0 })
    expect(engine.execute('GET lock').value).toBe('first')
  })

  it('clears no TTL it does not have — a brand new key starts with none', () => {
    const engine = createEngine()
    engine.execute('SETNX fresh v')
    expect(engine.execute('TTL fresh').value).toBe(-1)
  })
})

describe('DEBUG SLEEP (pre-existing)', () => {
  it('returns OK', () => {
    const engine = createEngine()
    const reply = engine.execute('DEBUG SLEEP 0')
    expect(reply.type).toBe('simple')
  })
})

describe('OBJECT FREQ (pre-existing)', () => {
  it('returns an integer for an existing key', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    const reply = engine.execute('OBJECT FREQ k')
    expect(reply.type).toBe('integer')
  })

  it('returns nil for a missing key', () => {
    const engine = createEngine()
    expect(engine.execute('OBJECT FREQ missing').type).toBe('nil')
  })
})

describe('MEMORY USAGE (pre-existing)', () => {
  it('returns a positive integer for an existing key', () => {
    const engine = createEngine()
    engine.execute('SET k v')
    const reply = engine.execute('MEMORY USAGE k')
    expect(reply.type).toBe('integer')
    expect(reply.value).toBeGreaterThan(0)
  })

  it('returns nil for a missing key', () => {
    const engine = createEngine()
    expect(engine.execute('MEMORY USAGE missing').type).toBe('nil')
  })
})
