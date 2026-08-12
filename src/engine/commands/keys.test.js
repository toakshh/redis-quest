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

describe('EXPIREAT', () => {
  it('sets expiry using Unix timestamp in seconds', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    // Expire at clock + 5 seconds = 1005000ms -> timestamp = 1005
    expect(timed.rawExecute('EXPIREAT', 'k', '1005')).toEqual(integer(1))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(5000))
  })

  it('returns 0 for missing key', () => {
    expect(engine.rawExecute('EXPIREAT', 'nope', '9999999999')).toEqual(integer(0))
  })

  it('deletes key if timestamp is in the past', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    expect(timed.rawExecute('EXPIREAT', 'k', '999')).toEqual(integer(1))
    expect(timed.rawExecute('EXISTS', 'k')).toEqual(integer(0))
  })

  it('rejects non-integer timestamp', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('EXPIREAT', 'k', 'abc')).toEqual(
      err('ERR value is not an integer or out of range')
    )
  })

  it('supports NX option - only set if no expiry', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('EXPIRE', 'k', '100')
    expect(timed.rawExecute('EXPIREAT', 'k', '2000', 'NX')).toEqual(integer(0))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(100000))
  })

  it('supports XX option - only set if expiry exists', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    // No expiry set
    expect(timed.rawExecute('EXPIREAT', 'k', '2000', 'XX')).toEqual(integer(0))
    // Now set expiry
    timed.rawExecute('EXPIRE', 'k', '100')
    expect(timed.rawExecute('EXPIREAT', 'k', '2000', 'XX')).toEqual(integer(1))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(1000000))
  })

  it('supports GT option - only if new expiry > current', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('EXPIRE', 'k', '100') // expires at 1100000ms
    // New timestamp 2000s = 2000000ms > 1100000ms -> should update
    expect(timed.rawExecute('EXPIREAT', 'k', '2000', 'GT')).toEqual(integer(1))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(1000000))
    // Try to set to lower timestamp -> should not update
    expect(timed.rawExecute('EXPIREAT', 'k', '1500', 'GT')).toEqual(integer(0))
  })

  it('supports LT option - only if new expiry < current', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('EXPIRE', 'k', '100') // expires at 1100000ms
    // New timestamp 1050s = 1050000ms < 1100000ms -> should update
    expect(timed.rawExecute('EXPIREAT', 'k', '1050', 'LT')).toEqual(integer(1))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(50000))
    // Try to set to higher timestamp -> should not update
    expect(timed.rawExecute('EXPIREAT', 'k', '2000', 'LT')).toEqual(integer(0))
  })

  it('rejects conflicting options', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('EXPIREAT', 'k', '1000', 'NX', 'XX')).toEqual(
      err('ERR syntax error')
    )
  })
})

describe('PEXPIREAT', () => {
  it('sets expiry using Unix timestamp in milliseconds', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    // Expire at clock + 5000ms = 1005000ms
    expect(timed.rawExecute('PEXPIREAT', 'k', '1005000')).toEqual(integer(1))
    expect(timed.rawExecute('PTTL', 'k')).toEqual(integer(5000))
  })

  it('returns 0 for missing key', () => {
    expect(engine.rawExecute('PEXPIREAT', 'nope', '9999999999')).toEqual(integer(0))
  })

  it('deletes key if timestamp is in the past', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    expect(timed.rawExecute('PEXPIREAT', 'k', '999999')).toEqual(integer(1))
    expect(timed.rawExecute('EXISTS', 'k')).toEqual(integer(0))
  })

  it('rejects non-integer timestamp', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('PEXPIREAT', 'k', 'abc')).toEqual(
      err('ERR value is not an integer or out of range')
    )
  })

  it('supports NX option - only set if no expiry', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    timed.rawExecute('PEXPIRE', 'k', '100000')
    expect(timed.rawExecute('PEXPIREAT', 'k', '2000000', 'NX')).toEqual(integer(0))
  })

  it('supports XX option - only set if expiry exists', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    expect(timed.rawExecute('PEXPIREAT', 'k', '2000000', 'XX')).toEqual(integer(0))
    timed.rawExecute('PEXPIRE', 'k', '100000')
    expect(timed.rawExecute('PEXPIREAT', 'k', '2000000', 'XX')).toEqual(integer(1))
  })
})

describe('SCAN', () => {
  it('returns cursor 0 and all keys for empty database', () => {
    const reply = engine.rawExecute('SCAN', '0')
    expect(reply.type).toBe('array')
    expect(reply.value[0]).toEqual(bulk('0'))
    expect(reply.value[1].type).toBe('array')
    expect(reply.value[1].value).toEqual([])
  })

  it('returns all keys with cursor 0', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('SET', 'c', '3')
    const reply = engine.rawExecute('SCAN', '0')
    expect(reply.value[0]).toEqual(bulk('0'))
    expect(reply.value[1].value.map(v => v.value).sort()).toEqual(['a', 'b', 'c'])
  })

  it('supports MATCH pattern', () => {
    engine.rawExecute('SET', 'user:1', 'a')
    engine.rawExecute('SET', 'user:2', 'b')
    engine.rawExecute('SET', 'admin', 'c')
    const reply = engine.rawExecute('SCAN', '0', 'MATCH', 'user:*')
    expect(reply.value[1].value.map(v => v.value).sort()).toEqual(['user:1', 'user:2'])
  })

  it('supports COUNT to limit results per iteration', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('SET', 'c', '3')
    engine.rawExecute('SET', 'd', '4')
    const reply = engine.rawExecute('SCAN', '0', 'COUNT', '2')
    expect(reply.value[1].value.length).toBeLessThanOrEqual(2)
    expect(reply.value[0]).not.toEqual(bulk('0')) // cursor should not be 0 if more results
  })

  it('supports TYPE filter', () => {
    engine.rawExecute('SET', 's', 'v')
    engine.rawExecute('HSET', 'h', 'f', 'v')
    engine.rawExecute('RPUSH', 'l', 'a')
    const reply = engine.rawExecute('SCAN', '0', 'TYPE', 'string')
    expect(reply.value[1].value.map(v => v.value)).toEqual([bulk('s').value])
  })

  it('excludes expired keys', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'live', 'a')
    timed.rawExecute('SET', 'dead', 'b')
    timed.rawExecute('PEXPIRE', 'dead', '10')
    clock = 100
    const reply = timed.rawExecute('SCAN', '0')
    expect(reply.value[1].value.map(v => v.value)).toEqual(['live'])
  })

  it('handles cursor iteration correctly', () => {
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('SET', 'b', '2')
    engine.rawExecute('SET', 'c', '3')
    // First iteration with COUNT 1
    let reply = engine.rawExecute('SCAN', '0', 'COUNT', '1')
    expect(reply.value[1].value.length).toBe(1)
    const cursor1 = reply.value[0].value
    // Second iteration
    reply = engine.rawExecute('SCAN', cursor1, 'COUNT', '1')
    expect(reply.value[1].value.length).toBe(1)
    const cursor2 = reply.value[0].value
    // Third iteration - should return last key and cursor 0
    reply = engine.rawExecute('SCAN', cursor2, 'COUNT', '1')
    expect(reply.value[1].value.length).toBe(1)
    expect(reply.value[0]).toEqual(bulk('0'))
  })

  it('returns error for invalid cursor', () => {
    expect(engine.rawExecute('SCAN', 'abc')).toEqual(err('ERR invalid cursor'))
    expect(engine.rawExecute('SCAN', '-1')).toEqual(err('ERR invalid cursor'))
  })

  it('returns error for invalid count', () => {
    expect(engine.rawExecute('SCAN', '0', 'COUNT', 'abc')).toEqual(err('ERR invalid count'))
    expect(engine.rawExecute('SCAN', '0', 'COUNT', '0')).toEqual(err('ERR invalid count'))
  })

  it('returns error for unknown option', () => {
    expect(engine.rawExecute('SCAN', '0', 'UNKNOWN')).toEqual(err('ERR syntax error'))
  })

  it('works with MATCH and COUNT together', () => {
    engine.rawExecute('SET', 'user:1', 'a')
    engine.rawExecute('SET', 'user:2', 'b')
    engine.rawExecute('SET', 'user:3', 'c')
    engine.rawExecute('SET', 'admin', 'd')
    const reply = engine.rawExecute('SCAN', '0', 'MATCH', 'user:*', 'COUNT', '2')
    expect(reply.value[1].value.length).toBeLessThanOrEqual(2)
    reply.value[1].value.forEach(v => expect(v.value.startsWith('user:')).toBe(true))
  })
})

describe('OBJECT', () => {
  it('IDLETIME returns seconds since last access', () => {
    let clock = 1000000
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'k', 'v')
    // Access the key (GET updates lruTickTime)
    timed.rawExecute('GET', 'k')
    clock = 1005000 // 5 seconds later (5000ms)
    expect(timed.rawExecute('OBJECT', 'IDLETIME', 'k')).toEqual(integer(5))
  })

  it('IDLETIME returns nil for missing key', () => {
    expect(engine.rawExecute('OBJECT', 'IDLETIME', 'nope')).toEqual(nil)
  })

  it('IDLETIME returns wrong arity without key', () => {
    expect(engine.rawExecute('OBJECT', 'IDLETIME')).toEqual(
      err("ERR wrong number of arguments for 'OBJECT' command")
    )
  })

  it('FREQ returns LFU counter (dummy value)', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('OBJECT', 'FREQ', 'k')).toEqual(integer(10))
  })

  it('FREQ returns nil for missing key', () => {
    expect(engine.rawExecute('OBJECT', 'FREQ', 'nope')).toEqual(nil)
  })

  it('FREQ returns wrong arity without key', () => {
    expect(engine.rawExecute('OBJECT', 'FREQ')).toEqual(
      err("ERR wrong number of arguments for 'OBJECT' command")
    )
  })

  it('returns error for unknown subcommand', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('OBJECT', 'UNKNOWN', 'k')).toEqual(
      err("ERR unknown subcommand 'UNKNOWN'")
    )
  })

  it('returns wrong arity without subcommand', () => {
    expect(engine.rawExecute('OBJECT')).toEqual(
      err("ERR wrong number of arguments for 'OBJECT' command")
    )
  })
})
