import { describe, it, expect } from 'vitest'
import { createEngine } from '../engine.js'

function engineAt(fixedTime) {
  return createEngine({ now: () => fixedTime })
}

describe('XADD / XLEN', () => {
  it('auto-id XADD then XLEN is 1', () => {
    const engine = engineAt(100)
    const reply = engine.rawExecute('XADD', 'orders', '*', 'item', 'widget')
    expect(reply.type).toBe('bulk')
    expect(engine.rawExecute('XLEN', 'orders')).toEqual({ type: 'integer', value: 1 })
  })

  it('two XADDs at the same simulated millisecond produce n-0 and n-1', () => {
    const engine = engineAt(100)
    const r1 = engine.rawExecute('XADD', 'orders', '*', 'a', '1')
    const r2 = engine.rawExecute('XADD', 'orders', '*', 'a', '2')
    expect(r1.value).toBe('100-0')
    expect(r2.value).toBe('100-1')
  })

  it('rejects a stale explicit id with an ERR error reply', () => {
    const engine = engineAt(100)
    engine.rawExecute('XADD', 'orders', '5-5', 'a', '1')
    const reply = engine.rawExecute('XADD', 'orders', '5-2', 'a', '2')
    expect(reply.type).toBe('error')
    expect(reply.value).toMatch(/^ERR The ID specified/)
  })

  it('XADD on a wrong-type key returns WRONGTYPE', () => {
    const engine = engineAt(1)
    engine.rawExecute('SET', 'str', 'hello')
    const reply = engine.rawExecute('XADD', 'str', '*', 'a', '1')
    expect(reply.type).toBe('error')
    expect(reply.value).toMatch(/WRONGTYPE/)
  })

  it('XADD with an odd number of field/value args is a syntax error', () => {
    const engine = engineAt(1)
    const reply = engine.rawExecute('XADD', 'orders', '*', 'onlyfield')
    expect(reply.type).toBe('error')
  })

  it('XADD respects MAXLEN by trimming after insert', () => {
    const engine = engineAt(1)
    for (let i = 0; i < 5; i++) engine.rawExecute('XADD', 'orders', '*', 'n', String(i))
    engine.rawExecute('XADD', 'orders', 'MAXLEN', '3', '*', 'n', '5')
    expect(engine.rawExecute('XLEN', 'orders').value).toBe(3)
  })

  it('XLEN on a missing key is 0', () => {
    const engine = engineAt(1)
    expect(engine.rawExecute('XLEN', 'missing').value).toBe(0)
  })

  it('XLEN on a wrong-type key returns WRONGTYPE', () => {
    const engine = engineAt(1)
    engine.rawExecute('SET', 'str', 'hello')
    expect(engine.rawExecute('XLEN', 'str').type).toBe('error')
  })
})

describe('XRANGE / XREVRANGE', () => {
  function seededEngine() {
    const engine = engineAt(1)
    for (let i = 1; i <= 5; i++) {
      engine.rawExecute('XADD', 'orders', `${i}-0`, 'n', String(i))
    }
    return engine
  }

  it('XRANGE - + returns everything in ascending order', () => {
    const engine = seededEngine()
    const reply = engine.rawExecute('XRANGE', 'orders', '-', '+')
    expect(reply.type).toBe('array')
    expect(reply.value.length).toBe(5)
    expect(reply.value[0].value[0].value).toBe('1-0')
    expect(reply.value[4].value[0].value).toBe('5-0')
  })

  it('XRANGE respects inclusive bounds', () => {
    const engine = seededEngine()
    const reply = engine.rawExecute('XRANGE', 'orders', '2-0', '4-0')
    expect(reply.value.map((e) => e.value[0].value)).toEqual(['2-0', '3-0', '4-0'])
  })

  it('XRANGE with COUNT truncates', () => {
    const engine = seededEngine()
    const reply = engine.rawExecute('XRANGE', 'orders', '-', '+', 'COUNT', '2')
    expect(reply.value.length).toBe(2)
  })

  it('XRANGE nested reply shape is [id, [field, value, ...]]', () => {
    const engine = seededEngine()
    const reply = engine.rawExecute('XRANGE', 'orders', '1-0', '1-0')
    const [idReply, fieldsReply] = reply.value[0].value
    expect(idReply.type).toBe('bulk')
    expect(idReply.value).toBe('1-0')
    expect(fieldsReply.type).toBe('array')
    expect(fieldsReply.value.map((r) => r.value)).toEqual(['n', '1'])
  })

  it('XREVRANGE reverses order', () => {
    const engine = seededEngine()
    const reply = engine.rawExecute('XREVRANGE', 'orders', '+', '-')
    expect(reply.value.map((e) => e.value[0].value)).toEqual(['5-0', '4-0', '3-0', '2-0', '1-0'])
  })

  it('XRANGE on a missing key returns an empty array', () => {
    const engine = engineAt(1)
    expect(engine.rawExecute('XRANGE', 'orders', '-', '+').value).toEqual([])
  })

  it('XRANGE / XREVRANGE on a wrong-type key returns WRONGTYPE', () => {
    const engine = engineAt(1)
    engine.rawExecute('SET', 'str', 'hello')
    expect(engine.rawExecute('XRANGE', 'str', '-', '+').type).toBe('error')
    expect(engine.rawExecute('XREVRANGE', 'str', '+', '-').type).toBe('error')
  })
})

describe('XDEL', () => {
  it('removes the specified entry and returns the removed count', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XADD', 'orders', '2-0', 'a', '2')
    const reply = engine.rawExecute('XDEL', 'orders', '1-0')
    expect(reply.value).toBe(1)
    expect(engine.rawExecute('XLEN', 'orders').value).toBe(1)
  })

  it('XDEL on a missing key returns 0', () => {
    const engine = engineAt(1)
    expect(engine.rawExecute('XDEL', 'missing', '1-0').value).toBe(0)
  })

  it('XDEL on a wrong-type key returns WRONGTYPE', () => {
    const engine = engineAt(1)
    engine.rawExecute('SET', 'str', 'hello')
    expect(engine.rawExecute('XDEL', 'str', '1-0').type).toBe('error')
  })
})
