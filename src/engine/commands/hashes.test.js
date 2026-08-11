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
const wrongType = { type: 'error', value: 'WRONGTYPE Operation against a key holding the wrong kind of value' }

describe('HSET', () => {
  it('creates a hash and returns how many fields were newly added', () => {
    expect(engine.rawExecute('HSET', 'h', 'name', 'Alice')).toEqual(integer(1))
    expect(engine.rawExecute('HSET', 'h', 'name', 'Bob')).toEqual(integer(0))
    expect(engine.rawExecute('HSET', 'h', 'name', 'Carol', 'age', '30')).toEqual(integer(1))
  })

  it('stores values as strings', () => {
    engine.rawExecute('HSET', 'h', 'n', '5')
    expect(engine.rawExecute('HGET', 'h', 'n')).toEqual(bulk('5'))
  })

  it('rejects an odd number of field/value args after the key', () => {
    expect(engine.rawExecute('HSET', 'h', 'a', '1', 'b')).toEqual(
      err("ERR wrong number of arguments for 'hset' command"),
    )
  })

  it('returns wrong arity with too few tokens', () => {
    expect(engine.rawExecute('HSET', 'h')).toEqual(err("ERR wrong number of arguments for 'HSET' command"))
  })

  it('preserves an existing TTL on element writes', () => {
    engine.rawExecute('SET', 'h', 'x')
    engine.rawExecute('DEL', 'h')
    engine.rawExecute('HSET', 'h', 'a', '1')
    engine.rawExecute('PEXPIRE', 'h', '5000')
    engine.rawExecute('HSET', 'h', 'b', '2')
    expect(engine.rawExecute('PTTL', 'h')).toEqual(integer(5000))
  })
})

describe('HGET', () => {
  it('returns a field value', () => {
    engine.rawExecute('HSET', 'h', 'name', 'Alice')
    expect(engine.rawExecute('HGET', 'h', 'name')).toEqual(bulk('Alice'))
  })

  it('returns nil for a missing field or missing key', () => {
    engine.rawExecute('HSET', 'h', 'name', 'Alice')
    expect(engine.rawExecute('HGET', 'h', 'nope')).toEqual(nil)
    expect(engine.rawExecute('HGET', 'missing', 'nope')).toEqual(nil)
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HGET', 's', 'f')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 3 tokens', () => {
    expect(engine.rawExecute('HGET', 'h')).toEqual(err("ERR wrong number of arguments for 'HGET' command"))
  })
})

describe('HDEL', () => {
  it('removes fields and returns how many were removed', () => {
    engine.rawExecute('HSET', 'h', 'a', '1', 'b', '2', 'c', '3')
    expect(engine.rawExecute('HDEL', 'h', 'a', 'b')).toEqual(integer(2))
    expect(engine.rawExecute('HGETALL', 'h')).toEqual(array([bulk('c'), bulk('3')]))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('HDEL', 'missing', 'f')).toEqual(integer(0))
  })

  it('deletes the key when the last field is removed', () => {
    engine.rawExecute('HSET', 'h', 'a', '1')
    expect(engine.rawExecute('HDEL', 'h', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('EXISTS', 'h')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HDEL', 's', 'f')).toEqual(wrongType)
  })

  it('returns wrong arity without a field', () => {
    expect(engine.rawExecute('HDEL', 'h')).toEqual(err("ERR wrong number of arguments for 'HDEL' command"))
  })
})

describe('HEXISTS', () => {
  it('returns 1 for an existing field and 0 otherwise', () => {
    engine.rawExecute('HSET', 'h', 'a', '1')
    expect(engine.rawExecute('HEXISTS', 'h', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('HEXISTS', 'h', 'b')).toEqual(integer(0))
    expect(engine.rawExecute('HEXISTS', 'missing', 'a')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HEXISTS', 's', 'f')).toEqual(wrongType)
  })
})

describe('HGETALL / HKEYS / HVALS / HLEN', () => {
  it('returns fields and values in insertion order', () => {
    engine.rawExecute('HSET', 'h', 'a', '1', 'b', '2', 'c', '3')
    expect(engine.rawExecute('HGETALL', 'h')).toEqual(
      array([bulk('a'), bulk('1'), bulk('b'), bulk('2'), bulk('c'), bulk('3')]),
    )
    expect(engine.rawExecute('HKEYS', 'h')).toEqual(array([bulk('a'), bulk('b'), bulk('c')]))
    expect(engine.rawExecute('HVALS', 'h')).toEqual(array([bulk('1'), bulk('2'), bulk('3')]))
    expect(engine.rawExecute('HLEN', 'h')).toEqual(integer(3))
  })

  it('returns empty arrays and 0 for a missing key', () => {
    expect(engine.rawExecute('HGETALL', 'missing')).toEqual(array([]))
    expect(engine.rawExecute('HKEYS', 'missing')).toEqual(array([]))
    expect(engine.rawExecute('HVALS', 'missing')).toEqual(array([]))
    expect(engine.rawExecute('HLEN', 'missing')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HGETALL', 's')).toEqual(wrongType)
    expect(engine.rawExecute('HKEYS', 's')).toEqual(wrongType)
    expect(engine.rawExecute('HVALS', 's')).toEqual(wrongType)
    expect(engine.rawExecute('HLEN', 's')).toEqual(wrongType)
  })
})

describe('HMSET / HMGET', () => {
  it('sets multiple fields and returns OK', () => {
    expect(engine.rawExecute('HMSET', 'h', 'a', '1', 'b', '2')).toEqual(ok)
    expect(engine.rawExecute('HGETALL', 'h')).toEqual(array([bulk('a'), bulk('1'), bulk('b'), bulk('2')]))
  })

  it('rejects an odd number of field/value args', () => {
    expect(engine.rawExecute('HMSET', 'h', 'a', '1', 'b')).toEqual(
      err("ERR wrong number of arguments for 'hmset' command"),
    )
  })

  it('HMGET returns an array with nil for missing fields', () => {
    engine.rawExecute('HSET', 'h', 'a', '1')
    expect(engine.rawExecute('HMGET', 'h', 'a', 'b')).toEqual(array([bulk('1'), nil]))
    expect(engine.rawExecute('HMGET', 'missing', 'a', 'b')).toEqual(array([nil, nil]))
  })

  it('HMGET returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HMGET', 's', 'f')).toEqual(wrongType)
  })

  it('returns wrong arity with too few tokens', () => {
    expect(engine.rawExecute('HMSET', 'h')).toEqual(err("ERR wrong number of arguments for 'HMSET' command"))
    expect(engine.rawExecute('HMGET', 'h')).toEqual(err("ERR wrong number of arguments for 'HMGET' command"))
  })
})

describe('HINCRBY', () => {
  it('increments an integer field', () => {
    expect(engine.rawExecute('HINCRBY', 'h', 'n', '5')).toEqual(integer(5))
    expect(engine.rawExecute('HINCRBY', 'h', 'n', '3')).toEqual(integer(8))
    expect(engine.rawExecute('HINCRBY', 'h', 'n', '-10')).toEqual(integer(-2))
  })

  it('rejects a non-integer increment', () => {
    engine.rawExecute('HSET', 'h', 'n', '1')
    expect(engine.rawExecute('HINCRBY', 'h', 'n', 'abc')).toEqual(
      err('ERR value is not an integer or out of range'),
    )
  })

  it('rejects a field holding a non-integer value', () => {
    engine.rawExecute('HSET', 'h', 'f', 'x')
    expect(engine.rawExecute('HINCRBY', 'h', 'f', '1')).toEqual(err('ERR hash value is not an integer'))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HINCRBY', 's', 'f', '1')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 4 tokens', () => {
    expect(engine.rawExecute('HINCRBY', 'h', 'f')).toEqual(err("ERR wrong number of arguments for 'HINCRBY' command"))
  })
})

describe('HINCRBYFLOAT', () => {
  it('increments a float field and formats the result', () => {
    expect(engine.rawExecute('HINCRBYFLOAT', 'h', 'score', '0.5')).toEqual(bulk('0.5'))
    expect(engine.rawExecute('HINCRBYFLOAT', 'h', 'score', '1')).toEqual(bulk('1.5'))
    expect(engine.rawExecute('HINCRBYFLOAT', 'h', 'score', '-1.25')).toEqual(bulk('0.25'))
  })

  it('rejects a non-float increment', () => {
    engine.rawExecute('HSET', 'h', 'score', '1')
    expect(engine.rawExecute('HINCRBYFLOAT', 'h', 'score', 'abc')).toEqual(
      err('ERR value is not a valid float'),
    )
  })

  it('rejects a field holding a non-float value', () => {
    engine.rawExecute('HSET', 'h', 'f', 'x')
    expect(engine.rawExecute('HINCRBYFLOAT', 'h', 'f', '1.5')).toEqual(err('ERR hash value is not a float'))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HINCRBYFLOAT', 's', 'f', '1')).toEqual(wrongType)
  })
})

describe('HSETNX', () => {
  it('sets the field only when it does not exist', () => {
    expect(engine.rawExecute('HSETNX', 'h', 'a', '1')).toEqual(integer(1))
    expect(engine.rawExecute('HSETNX', 'h', 'a', '2')).toEqual(integer(0))
    expect(engine.rawExecute('HGET', 'h', 'a')).toEqual(bulk('1'))
    expect(engine.rawExecute('HSETNX', 'h', 'b', '2')).toEqual(integer(1))
  })

  it('returns wrongtype against a non-hash key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('HSETNX', 's', 'f', '1')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 4 tokens', () => {
    expect(engine.rawExecute('HSETNX', 'h', 'f')).toEqual(err("ERR wrong number of arguments for 'HSETNX' command"))
  })
})
