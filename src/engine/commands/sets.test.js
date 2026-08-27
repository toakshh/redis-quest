// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../engine.js'

let engine

beforeEach(() => {
  engine = new MockRedisEngine()
})

const bulk = (value) => ({ type: 'bulk', value })
const integer = (value) => ({ type: 'integer', value })
const array = (value) => ({ type: 'array', value })
const nil = { type: 'nil', value: null }
const err = (value) => ({ type: 'error', value })
const wrongType = { type: 'error', value: 'WRONGTYPE Operation against a key holding the wrong kind of value' }

describe('SADD / SREM', () => {
  it('SADD adds members and returns how many were new', () => {
    expect(engine.rawExecute('SADD', 's', 'a', 'b')).toEqual(integer(2))
    expect(engine.rawExecute('SADD', 's', 'b', 'c')).toEqual(integer(1))
    expect(engine.rawExecute('SCARD', 's')).toEqual(integer(3))
  })

  it('SREM removes members and returns how many were removed', () => {
    engine.rawExecute('SADD', 's', 'a', 'b', 'c')
    expect(engine.rawExecute('SREM', 's', 'a', 'c')).toEqual(integer(2))
    expect(engine.rawExecute('SMEMBERS', 's')).toEqual(array([bulk('b')]))
  })

  it('SREM returns 0 for a missing key', () => {
    expect(engine.rawExecute('SREM', 'missing', 'a')).toEqual(integer(0))
  })

  it('deletes the key when the last member is removed', () => {
    engine.rawExecute('SADD', 's', 'a')
    engine.rawExecute('SREM', 's', 'a')
    expect(engine.rawExecute('EXISTS', 's')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-set key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SADD', 'k', 'a')).toEqual(wrongType)
    expect(engine.rawExecute('SREM', 'k', 'a')).toEqual(wrongType)
  })

  it('returns wrong arity without members', () => {
    expect(engine.rawExecute('SADD', 's')).toEqual(err("ERR wrong number of arguments for 'SADD' command"))
    expect(engine.rawExecute('SREM', 's')).toEqual(err("ERR wrong number of arguments for 'SREM' command"))
  })
})

describe('SMEMBERS / SISMEMBER / SCARD', () => {
  it('returns set members as an array', () => {
    engine.rawExecute('SADD', 's', 'a', 'b')
    const reply = engine.rawExecute('SMEMBERS', 's')
    expect(reply.type).toBe('array')
    expect(new Set(reply.value.map((r) => r.value))).toEqual(new Set(['a', 'b']))
  })

  it('returns an empty array for a missing key', () => {
    expect(engine.rawExecute('SMEMBERS', 'missing')).toEqual(array([]))
  })

  it('SISMEMBER returns 1 or 0', () => {
    engine.rawExecute('SADD', 's', 'a')
    expect(engine.rawExecute('SISMEMBER', 's', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('SISMEMBER', 's', 'b')).toEqual(integer(0))
    expect(engine.rawExecute('SISMEMBER', 'missing', 'a')).toEqual(integer(0))
  })

  it('SCARD returns the cardinality and 0 for a missing key', () => {
    engine.rawExecute('SADD', 's', 'a', 'b', 'c')
    expect(engine.rawExecute('SCARD', 's')).toEqual(integer(3))
    expect(engine.rawExecute('SCARD', 'missing')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-set key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SMEMBERS', 'k')).toEqual(wrongType)
    expect(engine.rawExecute('SISMEMBER', 'k', 'a')).toEqual(wrongType)
    expect(engine.rawExecute('SCARD', 'k')).toEqual(wrongType)
  })
})

describe('SPOP', () => {
  it('removes and returns a member', () => {
    engine.rawExecute('SADD', 's', 'only')
    expect(engine.rawExecute('SPOP', 's')).toEqual(bulk('only'))
    expect(engine.rawExecute('EXISTS', 's')).toEqual(integer(0))
  })

  it('returns nil for a missing key', () => {
    expect(engine.rawExecute('SPOP', 'missing')).toEqual(nil)
  })

  it('returns an empty array for a missing key with a count', () => {
    expect(engine.rawExecute('SPOP', 'missing', '3')).toEqual(array([]))
  })

  it('pops up to count members as an array', () => {
    engine.rawExecute('SADD', 's', 'a', 'b', 'c')
    const reply = engine.rawExecute('SPOP', 's', '2')
    expect(reply.type).toBe('array')
    expect(reply.value).toHaveLength(2)
    expect(engine.rawExecute('SCARD', 's')).toEqual(integer(1))
  })

  it('rejects a negative count', () => {
    engine.rawExecute('SADD', 's', 'a')
    expect(engine.rawExecute('SPOP', 's', '-1')).toEqual(err('ERR value is out of range, must be positive'))
  })

  it('returns wrongtype against a non-set key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SPOP', 'k')).toEqual(wrongType)
  })
})

describe('SRANDMEMBER', () => {
  it('returns a member without removing it', () => {
    engine.rawExecute('SADD', 's', 'a', 'b')
    const reply = engine.rawExecute('SRANDMEMBER', 's')
    expect(reply.type).toBe('bulk')
    expect(['a', 'b']).toContain(reply.value)
    expect(engine.rawExecute('SCARD', 's')).toEqual(integer(2))
  })

  it('returns nil for a missing key', () => {
    expect(engine.rawExecute('SRANDMEMBER', 'missing')).toEqual(nil)
  })

  it('returns an empty array for a missing key with a count', () => {
    expect(engine.rawExecute('SRANDMEMBER', 'missing', '3')).toEqual(array([]))
  })

  it('returns up to count members for a positive count and more for a negative one', () => {
    engine.rawExecute('SADD', 's', 'a', 'b')
    const limited = engine.rawExecute('SRANDMEMBER', 's', '5')
    expect(limited.type).toBe('array')
    expect(limited.value).toHaveLength(2)
    const repeated = engine.rawExecute('SRANDMEMBER', 's', '-5')
    expect(repeated.type).toBe('array')
    expect(repeated.value).toHaveLength(5)
  })

  it('returns wrongtype against a non-set key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SRANDMEMBER', 'k')).toEqual(wrongType)
  })
})

describe('SMOVE', () => {
  it('moves a member between sets, returning 1', () => {
    engine.rawExecute('SADD', 'src', 'a')
    expect(engine.rawExecute('SMOVE', 'src', 'dst', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('SISMEMBER', 'src', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('SISMEMBER', 'dst', 'a')).toEqual(integer(1))
  })

  it('returns 0 when the member is absent or the source is missing', () => {
    engine.rawExecute('SADD', 'src', 'a')
    expect(engine.rawExecute('SMOVE', 'src', 'dst', 'nope')).toEqual(integer(0))
    expect(engine.rawExecute('SMOVE', 'missing', 'dst', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('EXISTS', 'dst')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-set source', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SMOVE', 'k', 'dst', 'a')).toEqual(wrongType)
  })

  it('returns wrongtype when the destination is the wrong type', () => {
    engine.rawExecute('SADD', 'src', 'a')
    engine.rawExecute('SET', 'dst', 'v')
    expect(engine.rawExecute('SMOVE', 'src', 'dst', 'a')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 4 tokens', () => {
    expect(engine.rawExecute('SMOVE', 'src', 'dst')).toEqual(err("ERR wrong number of arguments for 'SMOVE' command"))
  })
})

describe('SUNION / SINTER / SDIFF', () => {
  it('computes set algebra over multiple keys', () => {
    engine.rawExecute('SADD', 'a', 'x', 'y', 'z')
    engine.rawExecute('SADD', 'b', 'y', 'z', 'w')
    expect(engine.rawExecute('SUNION', 'a', 'b')).toEqual(array([bulk('x'), bulk('y'), bulk('z'), bulk('w')]))
    expect(engine.rawExecute('SINTER', 'a', 'b')).toEqual(array([bulk('y'), bulk('z')]))
    expect(engine.rawExecute('SDIFF', 'a', 'b')).toEqual(array([bulk('x')]))
  })

  it('treats missing keys as empty sets', () => {
    engine.rawExecute('SADD', 'a', 'x')
    expect(engine.rawExecute('SUNION', 'a', 'missing')).toEqual(array([bulk('x')]))
    expect(engine.rawExecute('SINTER', 'a', 'missing')).toEqual(array([]))
    expect(engine.rawExecute('SDIFF', 'a', 'missing')).toEqual(array([bulk('x')]))
  })

  it('returns wrongtype if any key is the wrong type', () => {
    engine.rawExecute('SADD', 'a', 'x')
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('SUNION', 'a', 'k')).toEqual(wrongType)
    expect(engine.rawExecute('SINTER', 'a', 'k')).toEqual(wrongType)
    expect(engine.rawExecute('SDIFF', 'a', 'k')).toEqual(wrongType)
  })

  it('returns wrong arity without a key', () => {
    expect(engine.rawExecute('SUNION')).toEqual(err("ERR wrong number of arguments for 'SUNION' command"))
    expect(engine.rawExecute('SINTER')).toEqual(err("ERR wrong number of arguments for 'SINTER' command"))
    expect(engine.rawExecute('SDIFF')).toEqual(err("ERR wrong number of arguments for 'SDIFF' command"))
  })
})
