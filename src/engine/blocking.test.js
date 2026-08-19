import { describe, it, expect } from 'vitest'
import { createEngine } from './engine.js'

describe('blocking-command replies', () => {
  it('BLPOP on an empty key returns type "blocked" with the right resumeOn', () => {
    const engine = createEngine()
    const reply = engine.execute('BLPOP missing 5')
    expect(reply.type).toBe('blocked')
    expect(reply.resumeOn).toEqual(['missing'])
  })

  it('BLPOP timeout 0 gives timeoutAt: null (blocks forever)', () => {
    const engine = createEngine()
    const reply = engine.execute('BLPOP missing 0')
    expect(reply.timeoutAt).toBeNull()
  })

  it('BLPOP timeout 5 gives timeoutAt: now + 5000', () => {
    const engine = createEngine({ now: () => 1000 })
    const reply = engine.execute('BLPOP missing 5')
    expect(reply.timeoutAt).toBe(6000)
  })

  it('BLPOP on a populated key returns the normal array reply, unchanged', () => {
    const engine = createEngine()
    engine.execute('RPUSH queue job1')
    const reply = engine.execute('BLPOP queue 5')
    expect(reply.type).toBe('array')
    expect(reply.value.map((r) => r.value)).toEqual(['queue', 'job1'])
  })

  it('BZPOPMIN on an empty key returns type "blocked" with the right resumeOn', () => {
    const engine = createEngine()
    const reply = engine.execute('BZPOPMIN missing 5')
    expect(reply.type).toBe('blocked')
    expect(reply.resumeOn).toEqual(['missing'])
  })

  it('BZPOPMIN timeout 0 gives timeoutAt: null', () => {
    const engine = createEngine()
    const reply = engine.execute('BZPOPMIN missing 0')
    expect(reply.timeoutAt).toBeNull()
  })

  it('BZPOPMIN timeout 5 gives timeoutAt: now + 5000', () => {
    const engine = createEngine({ now: () => 2000 })
    const reply = engine.execute('BZPOPMIN missing 5')
    expect(reply.timeoutAt).toBe(7000)
  })

  it('BZPOPMIN on a populated key returns the normal array reply, unchanged', () => {
    const engine = createEngine()
    engine.execute('ZADD board 1 alice')
    const reply = engine.execute('BZPOPMIN board 5')
    expect(reply.type).toBe('array')
    expect(reply.value[0].value).toBe('board')
    expect(reply.value[1].value).toBe('alice')
  })
})
