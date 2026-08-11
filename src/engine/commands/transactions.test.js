// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { MockRedisEngine } from '../engine.js'

let engine

beforeEach(() => {
  engine = new MockRedisEngine()
})

const ok = { type: 'simple', value: 'OK' }
const queued = { type: 'simple', value: 'QUEUED' }
const bulk = (value) => ({ type: 'bulk', value })
const integer = (value) => ({ type: 'integer', value })
const array = (value) => ({ type: 'array', value })
const nil = { type: 'nil', value: null }
const err = (value) => ({ type: 'error', value })

describe('MULTI / EXEC', () => {
  it('queues commands and executes them in order on EXEC', () => {
    expect(engine.rawExecute('MULTI')).toEqual(ok)
    expect(engine.rawExecute('SET', 'a', '1')).toEqual(queued)
    expect(engine.rawExecute('SET', 'b', '2')).toEqual(queued)
    expect(engine.rawExecute('EXEC')).toEqual(array([ok, ok]))
    expect(engine.rawExecute('GET', 'a')).toEqual(bulk('1'))
    expect(engine.rawExecute('GET', 'b')).toEqual(bulk('2'))
  })

  it('returns real replies inside the EXEC array', () => {
    engine.rawExecute('SET', 'n', '5')
    engine.rawExecute('MULTI')
    engine.rawExecute('INCR', 'n')
    engine.rawExecute('GET', 'n')
    expect(engine.rawExecute('EXEC')).toEqual(array([integer(6), bulk('6')]))
  })

  it('returns an empty array for an empty transaction', () => {
    engine.rawExecute('MULTI')
    expect(engine.rawExecute('EXEC')).toEqual(array([]))
  })

  it('rejects nested MULTI calls', () => {
    engine.rawExecute('MULTI')
    expect(engine.rawExecute('MULTI')).toEqual(err('ERR MULTI calls can not be nested'))
  })

  it('rejects EXEC outside a MULTI block', () => {
    expect(engine.rawExecute('EXEC')).toEqual(err('ERR EXEC without MULTI'))
  })

  it('returns an error reply for a queued command that errors at runtime', () => {
    engine.rawExecute('MULTI')
    engine.rawExecute('INCR', 'n')
    expect(engine.rawExecute('EXEC')).toEqual(array([integer(1)]))
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'k', 'v')
    engine.rawExecute('INCR', 'k')
    const reply = engine.rawExecute('EXEC')
    expect(reply.type).toBe('array')
    expect(reply.value).toHaveLength(2)
    expect(reply.value[1].type).toBe('error')
    expect(reply.value[1].value).toBe('ERR value is not an integer or out of range')
  })
})

describe('queued arity errors', () => {
  it('aborts the whole batch with EXECABORT on EXEC', () => {
    engine.rawExecute('MULTI')
    expect(engine.rawExecute('SET', 'a', '1')).toEqual(queued)
    expect(engine.rawExecute('GET')).toEqual(
      err("ERR wrong number of arguments for 'GET' command"),
    )
    expect(engine.rawExecute('EXEC')).toEqual(
      err('EXECABORT Transaction discarded because of previous errors.'),
    )
    // none of the queued writes were applied
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
  })

  it('lets a fresh MULTI run after an abort', () => {
    engine.rawExecute('MULTI')
    engine.rawExecute('GET')
    engine.rawExecute('EXEC')
    engine.rawExecute('MULTI')
    expect(engine.rawExecute('SET', 'a', '1')).toEqual(queued)
    expect(engine.rawExecute('EXEC')).toEqual(array([ok]))
  })
})

describe('DISCARD', () => {
  it('discards the queue without applying anything', () => {
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'a', '1')
    expect(engine.rawExecute('DISCARD')).toEqual(ok)
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
  })

  it('rejects DISCARD outside a MULTI block', () => {
    expect(engine.rawExecute('DISCARD')).toEqual(err('ERR DISCARD without MULTI'))
  })
})

describe('WATCH / UNWATCH', () => {
  it('aborts EXEC when a watched key is modified', () => {
    engine.rawExecute('SET', 'bal', '5')
    expect(engine.rawExecute('WATCH', 'bal')).toEqual(ok)
    engine.rawExecute('SET', 'bal', '10')
    engine.rawExecute('MULTI')
    engine.rawExecute('INCR', 'bal')
    expect(engine.rawExecute('EXEC')).toEqual(nil)
    expect(engine.rawExecute('GET', 'bal')).toEqual(bulk('10'))
  })

  it('runs the transaction when no watched key changed', () => {
    engine.rawExecute('SET', 'bal', '5')
    engine.rawExecute('WATCH', 'bal')
    engine.rawExecute('MULTI')
    engine.rawExecute('INCR', 'bal')
    expect(engine.rawExecute('EXEC')).toEqual(array([integer(6)]))
    expect(engine.rawExecute('GET', 'bal')).toEqual(bulk('6'))
  })

  it('aborts when a watched key is deleted', () => {
    engine.rawExecute('SET', 'bal', '5')
    engine.rawExecute('WATCH', 'bal')
    engine.rawExecute('DEL', 'bal')
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'x', 'y')
    expect(engine.rawExecute('EXEC')).toEqual(nil)
    expect(engine.rawExecute('EXISTS', 'x')).toEqual(integer(0))
  })

  it('aborts when a watched key expires', () => {
    let clock = 0
    const timed = new MockRedisEngine({ now: () => clock })
    timed.rawExecute('SET', 'temp', 'v')
    timed.rawExecute('PEXPIRE', 'temp', '10')
    timed.rawExecute('WATCH', 'temp')
    clock = 100
    timed.rawExecute('MULTI')
    timed.rawExecute('SET', 'x', 'y')
    expect(timed.rawExecute('EXEC')).toEqual(nil)
  })

  it('aborts EXEC when FLUSHDB invalidates a watched key', () => {
    engine.rawExecute('SET', 'bal', '5')
    engine.rawExecute('WATCH', 'bal')
    engine.rawExecute('FLUSHDB')
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'x', 'y')
    expect(engine.rawExecute('EXEC')).toEqual(nil)
  })

  it('UNWATCH forgets watched keys', () => {
    engine.rawExecute('SET', 'bal', '5')
    engine.rawExecute('WATCH', 'bal')
    expect(engine.rawExecute('UNWATCH')).toEqual(ok)
    engine.rawExecute('SET', 'bal', '10')
    engine.rawExecute('MULTI')
    engine.rawExecute('INCR', 'bal')
    expect(engine.rawExecute('EXEC')).toEqual(array([integer(11)]))
    expect(engine.rawExecute('GET', 'bal')).toEqual(bulk('11'))
  })

  it('rejects WATCH inside a MULTI block', () => {
    engine.rawExecute('MULTI')
    expect(engine.rawExecute('WATCH', 'k')).toEqual(err('ERR WATCH inside MULTI is not allowed'))
    engine.rawExecute('DISCARD')
  })

  it('returns wrong arity for WATCH without keys', () => {
    expect(engine.rawExecute('WATCH')).toEqual(err("ERR wrong number of arguments for 'WATCH' command"))
  })
})

describe('transaction control commands are not queued', () => {
  it('DISCARD itself is not queued and clears the queue', () => {
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'a', '1')
    engine.rawExecute('DISCARD')
    engine.rawExecute('MULTI')
    engine.rawExecute('SET', 'b', '2')
    expect(engine.rawExecute('EXEC')).toEqual(array([ok]))
    expect(engine.rawExecute('GET', 'a')).toEqual(nil)
    expect(engine.rawExecute('GET', 'b')).toEqual(bulk('2'))
  })
})
