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

describe('XGROUP', () => {
  it('CREATE at $ then XREADGROUP > returns nothing until a new XADD', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    expect(engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$')).toEqual({
      type: 'simple',
      value: 'OK',
    })
    const reply = engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    expect(reply.type).toBe('nil')
  })

  it('CREATE without MKSTREAM on a missing key is an error', () => {
    const engine = engineAt(1)
    const reply = engine.rawExecute('XGROUP', 'CREATE', 'missing', 'workers', '$')
    expect(reply.type).toBe('error')
  })

  it('CREATE with MKSTREAM creates the stream and the group', () => {
    const engine = engineAt(1)
    const reply = engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$', 'MKSTREAM')
    expect(reply.type).toBe('simple')
    expect(engine.rawExecute('XLEN', 'orders').value).toBe(0)
  })

  it('CREATE on an already-existing group name returns BUSYGROUP', () => {
    const engine = engineAt(1)
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$', 'MKSTREAM')
    const reply = engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$')
    expect(reply.type).toBe('error')
    expect(reply.value).toMatch(/BUSYGROUP/)
  })

  it('CREATE at 0 starts delivery from the beginning of the stream', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    const reply = engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    expect(reply.type).toBe('array')
    expect(reply.value[0].value[1].value.length).toBe(1)
  })

  it('DESTROY removes the group', () => {
    const engine = engineAt(1)
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$', 'MKSTREAM')
    expect(engine.rawExecute('XGROUP', 'DESTROY', 'orders', 'workers').value).toBe(1)
    expect(engine.rawExecute('XGROUP', 'DESTROY', 'orders', 'workers').value).toBe(0)
  })

  it('CREATECONSUMER registers a consumer once', () => {
    const engine = engineAt(1)
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$', 'MKSTREAM')
    expect(engine.rawExecute('XGROUP', 'CREATECONSUMER', 'orders', 'workers', 'c1').value).toBe(1)
    expect(engine.rawExecute('XGROUP', 'CREATECONSUMER', 'orders', 'workers', 'c1').value).toBe(0)
  })

  it('DELCONSUMER removes a consumer and returns its pending count', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const reply = engine.rawExecute('XGROUP', 'DELCONSUMER', 'orders', 'workers', 'c1')
    expect(reply.value).toBe(1)
  })
})

describe('XREADGROUP / XACK — the pending entries list', () => {
  function setup() {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    return engine
  }

  it('delivery adds one PEL entry; XACK removes it', () => {
    const engine = setup()
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    expect(engine.rawExecute('XPENDING', 'orders', 'workers').value[0].value).toBe(1)
    const acked = engine.rawExecute('XACK', 'orders', 'workers', '1-0')
    expect(acked.value).toBe(1)
    expect(engine.rawExecute('XPENDING', 'orders', 'workers').value[0].value).toBe(0)
  })

  it('NOACK leaves the PEL empty', () => {
    const engine = setup()
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'NOACK', 'STREAMS', 'orders', '>')
    expect(engine.rawExecute('XPENDING', 'orders', 'workers').value[0].value).toBe(0)
  })

  it('explicit-id replay returns the same entry twice without advancing lastDeliveredId', () => {
    const engine = setup()
    const first = engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    expect(first.value[0].value[1].value.length).toBe(1)
    const replay = engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '0')
    expect(replay.value[0].value[1].value.length).toBe(1)
    expect(replay.value[0].value[1].value[0].value[0].value).toBe('1-0')
  })

  it('COUNT limits how many new entries are delivered', () => {
    const engine = engineAt(1)
    for (let i = 1; i <= 5; i++) engine.rawExecute('XADD', 'orders', `${i}-0`, 'n', String(i))
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    const reply = engine.rawExecute(
      'XREADGROUP', 'GROUP', 'workers', 'c1', 'COUNT', '2', 'STREAMS', 'orders', '>'
    )
    expect(reply.value[0].value[1].value.length).toBe(2)
  })

  it('reading against a missing group returns NOGROUP', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    const reply = engine.rawExecute('XREADGROUP', 'GROUP', 'ghost', 'c1', 'STREAMS', 'orders', '>')
    expect(reply.type).toBe('error')
    expect(reply.value).toMatch(/NOGROUP/)
  })

  it('XACK on a missing group returns 0, not an error', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    expect(engine.rawExecute('XACK', 'orders', 'ghost', '1-0').value).toBe(0)
  })
})

describe('XPENDING — short form', () => {
  it('an empty PEL returns [0, nil, nil, nil]', () => {
    const engine = engineAt(1)
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '$', 'MKSTREAM')
    const reply = engine.rawExecute('XPENDING', 'orders', 'workers')
    expect(reply.value[0]).toEqual({ type: 'integer', value: 0 })
    expect(reply.value[1]).toEqual({ type: 'nil', value: null })
    expect(reply.value[2]).toEqual({ type: 'nil', value: null })
    expect(reply.value[3]).toEqual({ type: 'nil', value: null })
  })
})

describe('XPENDING — extended form', () => {
  function busySetup() {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XADD', 'orders', '2-0', 'a', '2')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    return engine
  }

  it('reports the correct consumer per entry', () => {
    const engine = busySetup()
    const reply = engine.rawExecute('XPENDING', 'orders', 'workers', '-', '+', '10')
    expect(reply.type).toBe('array')
    expect(reply.value.length).toBe(2)
    expect(reply.value[0].value[1].value).toBe('c1')
  })

  it('filters by consumer name', () => {
    const engine = busySetup()
    const reply = engine.rawExecute('XPENDING', 'orders', 'workers', '-', '+', '10', 'c2')
    expect(reply.value.length).toBe(0)
  })
})

describe('XCLAIM', () => {
  function claimSetup() {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    return engine
  }

  it('min-idle-time above the actual idle claims nothing', () => {
    const engine = claimSetup()
    const reply = engine.rawExecute('XCLAIM', 'orders', 'workers', 'c2', '999999', '1-0')
    expect(reply.value).toEqual([])
  })

  it('min-idle-time below the actual idle transfers ownership and bumps deliveryCount', () => {
    const engine = engineAt(5000)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const reply = engine.rawExecute('XCLAIM', 'orders', 'workers', 'c2', '0', '1-0')
    expect(reply.value.length).toBe(1)
    const pending = engine.rawExecute('XPENDING', 'orders', 'workers', '-', '+', '10')
    expect(pending.value[0].value[1].value).toBe('c2')
    expect(pending.value[0].value[3].value).toBe(2)
  })
})

describe('XCLAIM — error paths', () => {
  it('claiming against a missing group returns NOGROUP', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    const reply = engine.rawExecute('XCLAIM', 'orders', 'ghost', 'c2', '0', '1-0')
    expect(reply.type).toBe('error')
    expect(reply.value).toMatch(/NOGROUP/)
  })
})

describe('XAUTOCLAIM', () => {
  it('walks the PEL from a cursor and claims eligible entries', () => {
    const engine = engineAt(1)
    for (let i = 1; i <= 3; i++) engine.rawExecute('XADD', 'orders', `${i}-0`, 'n', String(i))
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const reply = engine.rawExecute(
      'XAUTOCLAIM', 'orders', 'workers', 'c2', '0', '0', 'COUNT', '10'
    )
    expect(reply.type).toBe('array')
    expect(reply.value[1].value.length).toBe(3)
  })
})

describe('XINFO', () => {
  it('GROUPS reports the pending count', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const reply = engine.rawExecute('XINFO', 'GROUPS', 'orders')
    expect(reply.value[0].value[5].value).toBe(1) // 'pending' value slot
  })

  it('STREAM reports length and group count', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    const reply = engine.rawExecute('XINFO', 'STREAM', 'orders')
    expect(reply.value[1].value).toBe(1)
    expect(reply.value[5].value).toBe(1)
  })

  it('CONSUMERS lists registered consumers', () => {
    const engine = engineAt(1)
    engine.rawExecute('XADD', 'orders', '1-0', 'a', '1')
    engine.rawExecute('XGROUP', 'CREATE', 'orders', 'workers', '0')
    engine.rawExecute('XREADGROUP', 'GROUP', 'workers', 'c1', 'STREAMS', 'orders', '>')
    const reply = engine.rawExecute('XINFO', 'CONSUMERS', 'orders', 'workers')
    expect(reply.value.length).toBe(1)
    expect(reply.value[0].value[1].value).toBe('c1')
  })
})
