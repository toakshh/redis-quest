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

describe('LPUSH / RPUSH', () => {
  it('prepends values in order, returning the new length', () => {
    expect(engine.rawExecute('LPUSH', 'l', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('LPUSH', 'l', 'b', 'c')).toEqual(integer(3))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('c'), bulk('b'), bulk('a')]),
    )
  })

  it('appends values in order, returning the new length', () => {
    expect(engine.rawExecute('RPUSH', 'l', 'a')).toEqual(integer(1))
    expect(engine.rawExecute('RPUSH', 'l', 'b', 'c')).toEqual(integer(3))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('a'), bulk('b'), bulk('c')]),
    )
  })

  it('returns wrong arity without a value', () => {
    expect(engine.rawExecute('LPUSH', 'l')).toEqual(err("ERR wrong number of arguments for 'LPUSH' command"))
    expect(engine.rawExecute('RPUSH', 'l')).toEqual(err("ERR wrong number of arguments for 'RPUSH' command"))
  })

  it('preserves an existing TTL on element writes', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    engine.rawExecute('PEXPIRE', 'l', '5000')
    engine.rawExecute('RPUSH', 'l', 'b')
    // TTL may tick down by a few ms between PEXPIRE and PTTL — assert a sane
    // window rather than an exact value to avoid wall-clock flakiness.
    const { value } = engine.rawExecute('PTTL', 'l')
    expect(value).toBeGreaterThan(4900)
    expect(value).toBeLessThanOrEqual(5000)
  })
})

describe('LPOP / RPOP', () => {
  it('pops from the head and tail', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('LPOP', 'l')).toEqual(bulk('a'))
    expect(engine.rawExecute('RPOP', 'l')).toEqual(bulk('c'))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(array([bulk('b')]))
  })

  it('returns nil when popping an empty or missing list', () => {
    expect(engine.rawExecute('LPOP', 'missing')).toEqual(nil)
    expect(engine.rawExecute('RPOP', 'missing')).toEqual(nil)
    engine.rawExecute('RPUSH', 'l', 'x')
    engine.rawExecute('LPOP', 'l')
    expect(engine.rawExecute('LPOP', 'l')).toEqual(nil)
  })

  it('supports a count argument returning an array', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c', 'd')
    expect(engine.rawExecute('LPOP', 'l', '2')).toEqual(array([bulk('a'), bulk('b')]))
    expect(engine.rawExecute('RPOP', 'l', '2')).toEqual(array([bulk('d'), bulk('c')]))
  })

  it('returns an empty array when counting a missing list', () => {
    expect(engine.rawExecute('LPOP', 'missing', '2')).toEqual(array([]))
    expect(engine.rawExecute('RPOP', 'missing', '2')).toEqual(array([]))
  })

  it('rejects a negative count', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LPOP', 'l', '-1')).toEqual(err('ERR value is out of range, must be positive'))
    expect(engine.rawExecute('RPOP', 'l', '-1')).toEqual(err('ERR value is out of range, must be positive'))
  })

  it('rejects a non-integer count', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LPOP', 'l', 'x')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('deletes the key when the last element is popped', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    engine.rawExecute('LPOP', 'l')
    expect(engine.rawExecute('EXISTS', 'l')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LPOP', 's')).toEqual(wrongType)
    expect(engine.rawExecute('RPOP', 's')).toEqual(wrongType)
  })
})

describe('LLEN', () => {
  it('returns the list length', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('LLEN', 'l')).toEqual(integer(3))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('LLEN', 'missing')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LLEN', 's')).toEqual(wrongType)
  })
})

describe('LRANGE', () => {
  it('returns a subset of the list', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c', 'd')
    expect(engine.rawExecute('LRANGE', 'l', '1', '2')).toEqual(array([bulk('b'), bulk('c')]))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('a'), bulk('b'), bulk('c'), bulk('d')]),
    )
  })

  it('clamps out-of-range bounds and returns an empty array for empty ranges', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b')
    expect(engine.rawExecute('LRANGE', 'l', '0', '100')).toEqual(array([bulk('a'), bulk('b')]))
    expect(engine.rawExecute('LRANGE', 'l', '5', '10')).toEqual(array([]))
    expect(engine.rawExecute('LRANGE', 'l', '2', '1')).toEqual(array([]))
  })

  it('returns an empty array for a missing key', () => {
    expect(engine.rawExecute('LRANGE', 'missing', '0', '-1')).toEqual(array([]))
  })

  it('rejects a non-integer index', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LRANGE', 'l', 'x', '0')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LRANGE', 's', '0', '-1')).toEqual(wrongType)
  })

  it('returns wrong arity with fewer than 4 tokens', () => {
    expect(engine.rawExecute('LRANGE', 'l', '0')).toEqual(err("ERR wrong number of arguments for 'LRANGE' command"))
  })
})

describe('LINDEX', () => {
  it('returns the element at an index, negative from the tail', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('LINDEX', 'l', '0')).toEqual(bulk('a'))
    expect(engine.rawExecute('LINDEX', 'l', '2')).toEqual(bulk('c'))
    expect(engine.rawExecute('LINDEX', 'l', '-1')).toEqual(bulk('c'))
    expect(engine.rawExecute('LINDEX', 'l', '-3')).toEqual(bulk('a'))
  })

  it('returns nil for an out-of-range index or missing key', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LINDEX', 'l', '5')).toEqual(nil)
    expect(engine.rawExecute('LINDEX', 'l', '-5')).toEqual(nil)
    expect(engine.rawExecute('LINDEX', 'missing', '0')).toEqual(nil)
  })

  it('rejects a non-integer index', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LINDEX', 'l', 'x')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LINDEX', 's', '0')).toEqual(wrongType)
  })
})

describe('LSET', () => {
  it('sets the element at an index', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('LSET', 'l', '1', 'x')).toEqual(ok)
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('a'), bulk('x'), bulk('c')]),
    )
  })

  it('errors on a missing key', () => {
    expect(engine.rawExecute('LSET', 'missing', '0', 'x')).toEqual(err('ERR no such key'))
  })

  it('errors when the index is out of range', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LSET', 'l', '5', 'x')).toEqual(err('ERR index out of range'))
    expect(engine.rawExecute('LSET', 'l', '-2', 'x')).toEqual(err('ERR index out of range'))
  })

  it('rejects a non-integer index', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LSET', 'l', 'x', 'v')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LSET', 's', '0', 'x')).toEqual(wrongType)
  })
})

describe('LREM', () => {
  it('removes occurrences from the head for a positive count', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'a', 'b', 'a')
    expect(engine.rawExecute('LREM', 'l', '2', 'a')).toEqual(integer(2))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('b'), bulk('b'), bulk('a')]),
    )
  })

  it('removes occurrences from the tail for a negative count', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'a', 'b', 'a')
    expect(engine.rawExecute('LREM', 'l', '-2', 'a')).toEqual(integer(2))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('a'), bulk('b'), bulk('b')]),
    )
  })

  it('removes all occurrences for count 0', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'a', 'b', 'a')
    expect(engine.rawExecute('LREM', 'l', '0', 'a')).toEqual(integer(3))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(array([bulk('b'), bulk('b')]))
  })

  it('returns 0 for a missing key', () => {
    expect(engine.rawExecute('LREM', 'missing', '1', 'x')).toEqual(integer(0))
  })

  it('rejects a non-integer count', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LREM', 'l', 'x', 'a')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LREM', 's', '1', 'x')).toEqual(wrongType)
  })
})

describe('LTRIM', () => {
  it('trims the list to an inclusive range', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c', 'd', 'e')
    expect(engine.rawExecute('LTRIM', 'l', '1', '3')).toEqual(ok)
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(array([bulk('b'), bulk('c'), bulk('d')]))
  })

  it('supports negative indices', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c', 'd', 'e')
    engine.rawExecute('LTRIM', 'l', '-2', '-1')
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(array([bulk('d'), bulk('e')]))
  })

  it('deletes the key when the range is empty', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('LTRIM', 'l', '2', '1')).toEqual(ok)
    expect(engine.rawExecute('EXISTS', 'l')).toEqual(integer(0))
  })

  it('is a no-op on a missing key', () => {
    expect(engine.rawExecute('LTRIM', 'missing', '0', '-1')).toEqual(ok)
  })

  it('rejects a non-integer index', () => {
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('LTRIM', 'l', 'x', '0')).toEqual(err('ERR value is not an integer or out of range'))
  })

  it('returns wrongtype against a non-list key', () => {
    engine.rawExecute('SET', 's', 'v')
    expect(engine.rawExecute('LTRIM', 's', '0', '-1')).toEqual(wrongType)
  })
})

describe('RPOPLPUSH', () => {
  it('moves the tail of source to the head of destination', () => {
    engine.rawExecute('RPUSH', 'src', 'a', 'b', 'c')
    engine.rawExecute('RPUSH', 'dst', 'x')
    expect(engine.rawExecute('RPOPLPUSH', 'src', 'dst')).toEqual(bulk('c'))
    expect(engine.rawExecute('LRANGE', 'src', '0', '-1')).toEqual(array([bulk('a'), bulk('b')]))
    expect(engine.rawExecute('LRANGE', 'dst', '0', '-1')).toEqual(array([bulk('c'), bulk('x')]))
  })

  it('rotates the list when source equals destination', () => {
    engine.rawExecute('RPUSH', 'l', 'a', 'b', 'c')
    expect(engine.rawExecute('RPOPLPUSH', 'l', 'l')).toEqual(bulk('c'))
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(
      array([bulk('c'), bulk('a'), bulk('b')]),
    )
  })

  it('returns nil when the source is missing', () => {
    expect(engine.rawExecute('RPOPLPUSH', 'missing', 'dst')).toEqual(nil)
    expect(engine.rawExecute('EXISTS', 'dst')).toEqual(integer(0))
  })

  it('returns wrongtype against a non-list source or destination', () => {
    engine.rawExecute('SET', 's', 'v')
    engine.rawExecute('RPUSH', 'l', 'a')
    expect(engine.rawExecute('RPOPLPUSH', 's', 'l')).toEqual(wrongType)
    expect(engine.rawExecute('RPOPLPUSH', 'l', 's')).toEqual(wrongType)
    expect(engine.rawExecute('LRANGE', 'l', '0', '-1')).toEqual(array([bulk('a')]))
  })
})
