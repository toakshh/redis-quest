// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../engine.js'

let engine

beforeEach(() => {
  engine = new MockRedisEngine()
})

const ok = { type: 'simple', value: 'OK' }
const bulk = (value) => ({ type: 'bulk', value })
const integer = (value) => ({ type: 'integer', value })
const array = (value) => ({ type: 'array', value })
const nil = { type: 'nil', value: null }
const err = (value) => ({ type: 'error', value })

describe('DEL', () => {
  it('deletes one or more keys and returns how many were removed', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    expect(engine.rawExecute('DEL', 'a', 'b', 'missing')).toEqual(integer(2))
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
    expect(engine.rawExecute('GET', 'b')).toEqual(nil)
  })

  it('returns 0 when no keys exist', () => {
    expect(engine.rawExecute('DEL', 'nope')).toEqual(integer(0))
  })

  it('returns wrong arity for DEL without keys', () => {
    expect(engine.rawExecute('DEL')).toEqual(err("ERR wrong number of arguments for 'DEL' command"))
  })
})

describe('EXISTS', () => {
  it('counts how many of the given keys exist', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    expect(engine.rawExecute('EXISTS', 'a', 'b', 'c')).toEqual(integer(2))
    expect(engine.rawExecute('EXISTS', 'c')).toEqual(integer(0))
  })

  it('returns wrong arity without a key', () => {
    expect(engine.rawExecute('EXISTS')).toEqual(err("ERR wrong number of arguments for 'EXISTS' command"))
  })
})

describe('TYPE', () => {
  it('returns the value type of a key', () => {
    engine.rawExecute('SET', 's', 'v')
    engine.rawExecute('HSET', 'h', 'f', 'v')
    engine.rawExecute('RPUSH', 'l', 'a')
    engine.rawExecute('SADD', 'set', 'a')
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('TYPE', 's')).toEqual({ type: 'simple', value: 'string' })
    expect(engine.rawExecute('TYPE', 'h')).toEqual({ type: 'simple', value: 'hash' })
    expect(engine.rawExecute('TYPE', 'l')).toEqual({ type: 'simple', value: 'list' })
    expect(engine.rawExecute('TYPE', 'set')).toEqual({ type: 'simple', value: 'set' })
    expect(engine.rawExecute('TYPE', 'z')).toEqual({ type: 'simple', value: 'zset' })
  })

  it('returns none for a missing key', () => {
    expect(engine.rawExecute('TYPE', 'nope')).toEqual({ type: 'simple', value: 'none' })
  })

  it('returns wrong arity without a key', () => {
    expect(engine.rawExecute('TYPE')).toEqual(err("ERR wrong number of arguments for 'TYPE' command"))
  })
})

describe('EXPIRE / PEXPIRE', () => {
  it('sets a seconds TTL and the key still exists', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('EXPIRE', 'k', '60')).toEqual(integer(1))
    expect(engine.rawExecute('GET', 'k')).toEqual(bulk('v'))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('EXPIRE', 'nope', '60')).toEqual(integer(0))
    expect(engine.rawExecute('PEXPIRE', 'nope', '60000')).toEqual(integer(0))
  })

  it('non-positive seconds delete the key immediately', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('EXPIRE', 'k', '0')).toEqual(integer(1))
    expect(engine.rawExecute('EXISTS', 'k')).toEqual(integer(0))
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('PEXPIRE', 'k', '-5')).toEqual(integer(1))
    expect(engine.rawExecute('EXISTS', 'k')).toEqual(integer(0))
  })

  it('rejects a non-integer timeout', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('EXPIRE', 'k', 'abc')).toEqual(
      err('ERR value is not an integer or out of range'),
    )
    expect(engine.rawExecute('PEXPIRE', 'k', 'abc')).toEqual(
      err('ERR value is not an integer or out of range'),
    )
  })

  it('works against any data type, not just strings', () => {
    engine.rawExecute('HSET', 'h', 'f', 'v')
    expect(engine.rawExecute('EXPIRE', 'h', '10')).toEqual(integer(1))
  })

  it('returns wrong arity when the timeout is missing', () => {
    expect(engine.rawExecute('EXPIRE', 'k')).toEqual(err("ERR wrong number of arguments for 'EXPIRE' command"))
    expect(engine.rawExecute('PEXPIRE', 'k')).toEqual(err("ERR wrong number of arguments for 'PEXPIRE' command"))
  })
})

describe('TTL / PTTL', () => {
  it('returns -2 for a missing key and -1 for a persistent key', () => {
    expect(engine.rawExecute('TTL', 'nope')).toEqual(integer(-2))
    expect(engine.rawExecute('PTTL', 'nope')).toEqual(integer(-2))
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('TTL', 'k')).toEqual(integer(-1))
    expect(engine.rawExecute('PTTL', 'k')).toEqual(integer(-1))
  })

  it('counts down against an injectable clock', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('PEXPIRE', 'k', '5000')
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(5000))
    clock = 1000
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(4000))
    expect(timed.rawExecute('TTL', 'k')).toEqual(integer(4))
  })

  it('rounds TTL to the nearest whole second', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('PEXPIRE', 'k', '1500')
    expect(timed.rawExecute('TTL', 'k')).toEqual(integer(2))
  })

  it('drops an expired key once the clock passes the deadline', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('PEXPIRE', 'k', '1')
    clock = 1000
    expect(timed.rawExecute('GET', 'k')).toEqual(nil)
    expect(timed.rawExecute('EXISTS', 'k')).toEqual(integer(0))
    expect(timed.rawExecute('TTL', 'k')).toEqual(integer(-2))
  })

  it('returns wrong arity without a key', () => {
    expect(engine.rawExecute('TTL')).toEqual(err("ERR wrong number of arguments for 'TTL' command"))
    expect(engine.rawExecute('PTTL')).toEqual(err("ERR wrong number of arguments for 'PTTL' command"))
  })
})

describe('PERSIST', () => {
  it('removes a timeout, returning 1', () => {
    engine.rawExecute('SET', 'k', 'v')
    engine.rawExecute('EXPIRE', 'k', '60')
    expect(engine.rawExecute('PERSIST', 'k')).toEqual(integer(1))
    expect(engine.rawExecute('TTL', 'k')).toEqual(integer(-1))
  })

  it('returns 0 when the key has no timeout or is missing', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('PERSIST', 'k')).toEqual(integer(0))
    expect(engine.rawExecute('PERSIST', 'nope')).toEqual(integer(0))
  })

  it('returns wrong arity without a key', () => {
    expect(engine.rawExecute('PERSIST')).toEqual(err("ERR wrong number of arguments for 'PERSIST' command"))
  })
})

describe('KEYS', () => {
  it('matches glob patterns', () => {
    engine.rawExecute('SET', 'user:1', 'a')
    engine.rawExecute('SET', 'user:2', 'b')
    engine.rawExecute('SET', 'admin', 'c')
    expect(engine.rawExecute('KEYS', 'user:*')).toEqual(array([bulk('user:1'), bulk('user:2')]))
    expect(engine.rawExecute('KEYS', '?dmin')).toEqual(array([bulk('admin')]))
    expect(engine.rawExecute('KEYS', 'user:[12]')).toEqual(array([bulk('user:1'), bulk('user:2')]))
    expect(engine.rawExecute('KEYS', 'nope*')).toEqual(array([]))
  })

  it('excludes expired keys from the scan', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'live', 'a')
    timed.rawExecute('SET', 'dead', 'b')
    timed.rawExecute('PEXPIRE', 'dead', '10')
    clock = 100
    expect(timed.rawExecute('KEYS', '*')).toEqual(array([bulk('live')]))
  })

  it('returns wrong arity without a pattern', () => {
    expect(engine.rawExecute('KEYS')).toEqual(err("ERR wrong number of arguments for 'KEYS' command"))
  })
})

describe('RENAME / RENAMENX', () => {
  it('renames a key and returns OK', () => {
    engine.rawExecute('SET', 'old', 'v')
    expect(engine.rawExecute('RENAME', 'old', 'new')).toEqual(ok)
    expect(engine.rawExecute('GET', 'old')).toEqual(nil)
    expect(engine.rawExecute('GET', 'new')).toEqual(bulk('v'))
  })

  it('overwrites the destination when it already exists', () => {
    engine.rawExecute('SET', 'old', 'v1')
    engine.rawExecute('SET', 'new', 'v2')
    engine.rawExecute('RENAME', 'old', 'new')
    expect(engine.rawExecute('GET', 'new')).toEqual(bulk('v1'))
  })

  it('rejects renaming a key to itself', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('RENAME', 'k', 'k')).toEqual(
      err('ERR source and destination objects are the same'),
    )
    expect(engine.rawExecute('RENAMENX', 'k', 'k')).toEqual(
      err('ERR source and destination objects are the same'),
    )
  })

  it('returns no such key when the source is missing', () => {
    expect(engine.rawExecute('RENAME', 'nope', 'new')).toEqual(err('ERR no such key'))
    expect(engine.rawExecute('RENAMENX', 'nope', 'new')).toEqual(err('ERR no such key'))
  })

  it('RENAMENX returns 0 when the destination exists', () => {
    engine.rawExecute('SET', 'old', 'v1')
    engine.rawExecute('SET', 'new', 'v2')
    expect(engine.rawExecute('RENAMENX', 'old', 'new')).toEqual(integer(0))
    expect(engine.rawExecute('GET', 'old')).toEqual(bulk('v1'))
  })

  it('RENAMENX returns 1 and renames when the destination is free', () => {
    engine.rawExecute('SET', 'old', 'v1')
    expect(engine.rawExecute('RENAMENX', 'old', 'new')).toEqual(integer(1))
    expect(engine.rawExecute('GET', 'new')).toEqual(bulk('v1'))
  })

  it('returns wrong arity with fewer than 3 tokens', () => {
    expect(engine.rawExecute('RENAME', 'a')).toEqual(err("ERR wrong number of arguments for 'RENAME' command"))
    expect(engine.rawExecute('RENAMENX', 'a')).toEqual(err("ERR wrong number of arguments for 'RENAMENX' command"))
  })
})

describe('RANDOMKEY', () => {
  it('returns nil when the database is empty', () => {
    expect(engine.rawExecute('RANDOMKEY')).toEqual(nil)
  })

  it('returns one of the live keys', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('SET', 'c', '3')
    const reply = engine.rawExecute('RANDOMKEY')
    expect(reply.type).toBe('bulk')
    expect(['a', 'b', 'c']).toContain(reply.value)
  })

  it('skips expired keys', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'live', '1')
    timed.rawExecute('SET', 'dead', '2')
    timed.rawExecute('PEXPIRE', 'dead', '1')
    clock = 1000
    expect(timed.rawExecute('RANDOMKEY')).toEqual(bulk('live'))
  })
})

describe('FLUSHDB / FLUSHALL', () => {
  it('FLUSHDB empties the active database only', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SELECT', '2')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('FLUSHDB')
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SELECT', '0')
    expect(engine.rawExecute('GET', 'a')).toEqual(bulk('1'))
  })

  it('FLUSHALL empties every database', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SELECT', '2')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('FLUSHALL')
    expect(engine.rawExecute('DBSIZE')).toEqual(integer(0))
    engine.rawExecute('SELECT', '0')
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
  })
})
