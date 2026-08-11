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

describe('ZADD', () => {
  it('adds members and returns how many were new', () => {
    expect(engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b')).toEqual(integer(2))
    expect(engine.rawExecute('ZADD', 'z', '1', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('ZCARD', 'z')).toEqual(integer(2))
  })

  it('sorts by score, then by member for ties', () => {
    engine.rawExecute('ZADD', 'z', '2', 'b', '1', 'a', '2', 'c')
    expect(engine.rawExecute('ZRANGE', 'z', '0', '-1')).toEqual(
      array([bulk('a'), bulk('b'), bulk('c')]),
    )
  })

  it('counts updates when CH is given', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZADD', 'z', 'CH', '3', 'a', '5', 'b')).toEqual(integer(2))
  })

  it('respects NX and XX options', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZADD', 'z', 'NX', '9', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('ZSCORE', 'z', 'a')).toEqual(bulk('1'))
    // XX updates existing members but never creates new ones
    expect(engine.rawExecute('ZADD', 'z', 'XX', '9', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('ZSCORE', 'z', 'a')).toEqual(bulk('9'))
    expect(engine.rawExecute('ZADD', 'z', 'XX', '9', 'newm')).toEqual(integer(0))
    expect(engine.rawExecute('ZADD', 'z', 'NX', '9', 'newm')).toEqual(integer(1))
  })

  it('supports INCR returning the new score as a bulk string', () => {
    expect(engine.rawExecute('ZADD', 'z', 'INCR', '5', 'a')).toEqual(bulk('5'))
    expect(engine.rawExecute('ZADD', 'z', 'INCR', '2', 'a')).toEqual(bulk('7'))
    expect(engine.rawExecute('ZSCORE', 'z', 'a')).toEqual(bulk('7'))
  })

  it('rejects invalid combinations of options', () => {
    expect(engine.rawExecute('ZADD', 'z', 'NX', 'XX', '1', 'a')).toEqual(
      err('ERR XX and NX options at the same time are not compatible'),
    )
    expect(engine.rawExecute('ZADD', 'z', 'INCR', 'GT', '1', 'a')).toEqual(
      err('ERR GT option not supported in combination with the INCR option'),
    )
    expect(engine.rawExecute('ZADD', 'z', 'GT', 'NX', '1', 'a')).toEqual(
      err('ERR GT option not supported in combination with the NX option'),
    )
    expect(engine.rawExecute('ZADD', 'z', 'INCR', '1', 'a', '2', 'b')).toEqual(
      err('ERR INCR option supports a single increment-element pair'),
    )
  })

  it('rejects a non-float score and an odd pair list', () => {
    expect(engine.rawExecute('ZADD', 'z', 'abc', 'a')).toEqual(err('ERR value is not a valid float'))
    expect(engine.rawExecute('ZADD', 'z', '1', 'a', '2')).toEqual(err('ERR syntax error'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZADD', 'k', '1', 'a')).toEqual(wrongType)
  })

  it('returns wrong arity with too few tokens', () => {
    expect(engine.rawExecute('ZADD', 'z')).toEqual(err("ERR wrong number of arguments for 'ZADD' command"))
  })

  it('preserves an existing TTL on element writes', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    engine.rawExecute('PEXPIRE', 'z', '5000')
    engine.rawExecute('ZADD', 'z', '2', 'b')
    expect(engine.rawExecute('PTTL', 'z')).toEqual(integer(5000))
  })
})

describe('ZREM', () => {
  it('removes members and returns how many were removed', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZREM', 'z', 'a', 'c')).toEqual(integer(2))
    expect(engine.rawExecute('ZCARD', 'z')).toEqual(integer(1))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('ZREM', 'missing', 'a')).toEqual(integer(0))
  })

  it('deletes the key when the last member is removed', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    engine.rawExecute('ZREM', 'z', 'a')
    expect(engine.rawExecute('EXISTS', 'z')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZREM', 'k', 'a')).toEqual(wrongType)
  })

  it('returns wrong arity without members', () => {
    expect(engine.rawExecute('ZREM', 'z')).toEqual(err("ERR wrong number of arguments for 'ZREM' command"))
  })
})

describe('ZSCORE / ZCARD', () => {
  it('returns a score formatted like Redis', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2.5', 'b', 'inf', 'c')
    expect(engine.rawExecute('ZSCORE', 'z', 'a')).toEqual(bulk('1'))
    expect(engine.rawExecute('ZSCORE', 'z', 'b')).toEqual(bulk('2.5'))
    expect(engine.rawExecute('ZSCORE', 'z', 'c')).toEqual(bulk('inf'))
    expect(engine.rawExecute('ZSCORE', 'z', 'missing')).toEqual(nil)
    expect(engine.rawExecute('ZSCORE', 'missing', 'a')).toEqual(nil)
  })

  it('ZCARD returns the cardinality and 0 for a missing key', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b')
    expect(engine.rawExecute('ZCARD', 'z')).toEqual(integer(2))
    expect(engine.rawExecute('ZCARD', 'missing')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZSCORE', 'k', 'a')).toEqual(wrongType)
    expect(engine.rawExecute('ZCARD', 'k')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 3 tokens for ZSCORE', () => {
    expect(engine.rawExecute('ZSCORE', 'z')).toEqual(err("ERR wrong number of arguments for 'ZSCORE' command"))
  })
})

describe('ZRANGE / ZREVRANGE', () => {
  it('returns members low-to-high and high-to-low', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZRANGE', 'z', '0', '-1')).toEqual(array([bulk('a'), bulk('b'), bulk('c')]))
    expect(engine.rawExecute('ZREVRANGE', 'z', '0', '-1')).toEqual(array([bulk('c'), bulk('b'), bulk('a')]))
  })

  it('returns scores when WITHSCORES is given', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b')
    expect(engine.rawExecute('ZRANGE', 'z', '0', '-1', 'WITHSCORES')).toEqual(
      array([bulk('a'), bulk('1'), bulk('b'), bulk('2')]),
    )
  })

  it('supports negative and out-of-range indices', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZRANGE', 'z', '1', '2')).toEqual(array([bulk('b'), bulk('c')]))
    expect(engine.rawExecute('ZRANGE', 'z', '-2', '-1')).toEqual(array([bulk('b'), bulk('c')]))
    expect(engine.rawExecute('ZRANGE', 'z', '5', '10')).toEqual(array([]))
  })

  it('returns an empty array for a missing key', () => {
    expect(engine.rawExecute('ZRANGE', 'missing', '0', '-1')).toEqual(array([]))
  })

  it('rejects a non-integer index', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZRANGE', 'z', 'x', '-1')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZRANGE', 'k', '0', '-1')).toEqual(wrongType)
    expect(engine.rawExecute('ZREVRANGE', 'k', '0', '-1')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 4 tokens', () => {
    expect(engine.rawExecute('ZRANGE', 'z', '0')).toEqual(err("ERR wrong number of arguments for 'ZRANGE' command"))
  })
})

describe('ZRANGEBYSCORE', () => {
  it('returns members within a score range', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c', '4', 'd')
    expect(engine.rawExecute('ZRANGEBYSCORE', 'z', '2', '3')).toEqual(array([bulk('b'), bulk('c')]))
    expect(engine.rawExecute('ZRANGEBYSCORE', 'z', '-inf', '+inf')).toEqual(
      array([bulk('a'), bulk('b'), bulk('c'), bulk('d')]),
    )
  })

  it('honors exclusive bounds and WITHSCORES / LIMIT', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c', '4', 'd')
    expect(engine.rawExecute('ZRANGEBYSCORE', 'z', '(1', '3')).toEqual(array([bulk('b'), bulk('c')]))
    expect(engine.rawExecute('ZRANGEBYSCORE', 'z', '1', '4', 'WITHSCORES', 'LIMIT', '1', '2')).toEqual(
      array([bulk('b'), bulk('2'), bulk('c'), bulk('3')]),
    )
  })

  it('returns an empty array for a missing key', () => {
    expect(engine.rawExecute('ZRANGEBYSCORE', 'missing', '-inf', '+inf')).toEqual(array([]))
  })

  it('rejects an invalid bound', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZRANGEBYSCORE', 'z', 'x', '+inf')).toEqual(err('ERR min or max is not a float'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZRANGEBYSCORE', 'k', '-inf', '+inf')).toEqual(wrongType)
  })
})

describe('ZCOUNT', () => {
  it('counts members within a score range', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c', '4', 'd')
    expect(engine.rawExecute('ZCOUNT', 'z', '2', '3')).toEqual(integer(2))
    expect(engine.rawExecute('ZCOUNT', 'z', '(2', '4')).toEqual(integer(2))
    expect(engine.rawExecute('ZCOUNT', 'z', '-inf', '+inf')).toEqual(integer(4))
    expect(engine.rawExecute('ZCOUNT', 'missing', '-inf', '+inf')).toEqual(integer(0))
  })

  it('rejects an invalid bound', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZCOUNT', 'z', 'x', '+inf')).toEqual(err('ERR min or max is not a float'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZCOUNT', 'k', '-inf', '+inf')).toEqual(wrongType)
  })
})

describe('ZRANK / ZREVRANK', () => {
  it('returns zero-based ranks', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZRANK', 'z', 'a')).toEqual(integer(0))
    expect(engine.rawExecute('ZRANK', 'z', 'c')).toEqual(integer(2))
    expect(engine.rawExecute('ZREVRANK', 'z', 'a')).toEqual(integer(2))
    expect(engine.rawExecute('ZREVRANK', 'z', 'c')).toEqual(integer(0))
  })

  it('returns nil for a missing member or key', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZRANK', 'z', 'missing')).toEqual(nil)
    expect(engine.rawExecute('ZRANK', 'missing', 'a')).toEqual(nil)
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZRANK', 'k', 'a')).toEqual(wrongType)
    expect(engine.rawExecute('ZREVRANK', 'k', 'a')).toEqual(wrongType)
  })
})

describe('ZINCRBY', () => {
  it('increments a member score and returns the formatted result', () => {
    expect(engine.rawExecute('ZINCRBY', 'z', '5', 'a')).toEqual(bulk('5'))
    expect(engine.rawExecute('ZINCRBY', 'z', '2.5', 'a')).toEqual(bulk('7.5'))
  })

  it('rejects an invalid increment', () => {
    expect(engine.rawExecute('ZINCRBY', 'z', 'abc', 'a')).toEqual(err('ERR value is not a valid float'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZINCRBY', 'k', '1', 'a')).toEqual(wrongType)
  })
})

describe('ZREMRANGEBYRANK / ZREMRANGEBYSCORE', () => {
  it('removes by rank and returns how many were removed', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZREMRANGEBYRANK', 'z', '0', '1')).toEqual(integer(2))
    expect(engine.rawExecute('ZRANGE', 'z', '0', '-1')).toEqual(array([bulk('c')]))
  })

  it('removes by score and returns how many were removed', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a', '2', 'b', '3', 'c')
    expect(engine.rawExecute('ZREMRANGEBYSCORE', 'z', '(1', '3')).toEqual(integer(2))
    expect(engine.rawExecute('ZRANGE', 'z', '0', '-1')).toEqual(array([bulk('a')]))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('ZREMRANGEBYRANK', 'missing', '0', '-1')).toEqual(integer(0))
    expect(engine.rawExecute('ZREMRANGEBYSCORE', 'missing', '-inf', '+inf')).toEqual(integer(0))
  })

  it('rejects an invalid bound for the score variant', () => {
    engine.rawExecute('ZADD', 'z', '1', 'a')
    expect(engine.rawExecute('ZREMRANGEBYSCORE', 'z', 'x', '+inf')).toEqual(err('ERR min or max is not a float'))
  })

  it('returns wrongtype against a non-zset key', () => {
    engine.rawExecute('SET', 'k', 'v')
    expect(engine.rawExecute('ZREMRANGEBYRANK', 'k', '0', '-1')).toEqual(wrongType)
    expect(engine.rawExecute('ZREMRANGEBYSCORE', 'k', '-inf', '+inf')).toEqual(wrongType)
  })
})
