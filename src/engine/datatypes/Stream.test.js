import { describe, it, expect } from 'vitest'
import { StreamId, RedisStream, ConsumerGroup, streamBytes } from './Stream.js'

describe('StreamId', () => {
  it('parses "1-2"', () => {
    const id = StreamId.parse('1-2')
    expect(id.ms).toBe(1)
    expect(id.seq).toBe(2)
  })

  it('parses "-" as min (0-0)', () => {
    const id = StreamId.parse('-')
    expect(id.ms).toBe(0)
    expect(id.seq).toBe(0)
  })

  it('parses "+" as max', () => {
    const id = StreamId.parse('+')
    expect(id.ms).toBe(Number.MAX_SAFE_INTEGER)
    expect(id.seq).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('parses a bare ms as ms-0', () => {
    const id = StreamId.parse('5')
    expect(id.ms).toBe(5)
    expect(id.seq).toBe(0)
  })

  it('throws on invalid input', () => {
    expect(() => StreamId.parse('not-an-id')).toThrow()
  })

  it('compares by ms first, then seq', () => {
    expect(new StreamId(1, 5).compare(new StreamId(2, 0))).toBe(-1)
    expect(new StreamId(2, 0).compare(new StreamId(1, 5))).toBe(1)
    expect(new StreamId(1, 1).compare(new StreamId(1, 2))).toBe(-1)
    expect(new StreamId(1, 1).compare(new StreamId(1, 1))).toBe(0)
  })

  it('isGreaterThan matches compare', () => {
    expect(new StreamId(2, 0).isGreaterThan(new StreamId(1, 0))).toBe(true)
    expect(new StreamId(1, 0).isGreaterThan(new StreamId(2, 0))).toBe(false)
  })

  it('toString round-trips', () => {
    expect(new StreamId(3, 4).toString()).toBe('3-4')
  })
})

describe('RedisStream.add — auto id monotonicity', () => {
  it('two adds in the same millisecond produce n-0 then n-1', () => {
    const s = new RedisStream()
    const id1 = s.add('*', new Map([['a', '1']]), 100)
    const id2 = s.add('*', new Map([['a', '2']]), 100)
    expect(id1.toString()).toBe('100-0')
    expect(id2.toString()).toBe('100-1')
  })

  it('advancing wall time resets seq to 0', () => {
    const s = new RedisStream()
    s.add('*', new Map(), 100)
    const id2 = s.add('*', new Map(), 200)
    expect(id2.toString()).toBe('200-0')
  })

  it('partial auto id "ms-*" increments seq when ms matches lastId', () => {
    const s = new RedisStream()
    s.add('5-1', new Map(), 5)
    const id2 = s.add('5-*', new Map(), 5)
    expect(id2.toString()).toBe('5-2')
  })

  it('partial auto id "ms-*" resets seq to 0 when ms differs from lastId', () => {
    const s = new RedisStream()
    s.add('5-1', new Map(), 5)
    const id2 = s.add('9-*', new Map(), 9)
    expect(id2.toString()).toBe('9-0')
  })
})

describe('RedisStream.add — explicit id rejection', () => {
  it('rejects an explicit id equal to lastId', () => {
    const s = new RedisStream()
    s.add('5-0', new Map(), 5)
    expect(() => s.add('5-0', new Map(), 5)).toThrow(/equal or smaller/)
  })

  it('rejects an explicit id smaller than lastId', () => {
    const s = new RedisStream()
    s.add('5-5', new Map(), 5)
    expect(() => s.add('5-2', new Map(), 5)).toThrow(/equal or smaller/)
  })

  it('accepts an explicit id greater than lastId', () => {
    const s = new RedisStream()
    s.add('5-0', new Map(), 5)
    const id2 = s.add('5-1', new Map(), 5)
    expect(id2.toString()).toBe('5-1')
  })
})

describe('RedisStream.range / revRange', () => {
  function seeded() {
    const s = new RedisStream()
    for (let i = 1; i <= 5; i++) s.add(`${i}-0`, new Map([['n', String(i)]]), i)
    return s
  }

  it('range returns the full inclusive set for - +', () => {
    const s = seeded()
    const out = s.range(StreamId.min(), StreamId.max())
    expect(out.map((e) => e.id.toString())).toEqual(['1-0', '2-0', '3-0', '4-0', '5-0'])
  })

  it('range respects inclusive bounds', () => {
    const s = seeded()
    const out = s.range(new StreamId(2, 0), new StreamId(4, 0))
    expect(out.map((e) => e.id.toString())).toEqual(['2-0', '3-0', '4-0'])
  })

  it('range with COUNT truncates', () => {
    const s = seeded()
    const out = s.range(StreamId.min(), StreamId.max(), 2)
    expect(out.length).toBe(2)
    expect(out.map((e) => e.id.toString())).toEqual(['1-0', '2-0'])
  })

  it('revRange reverses order within the same inclusive bounds', () => {
    const s = seeded()
    const out = s.revRange(new StreamId(2, 0), new StreamId(4, 0))
    expect(out.map((e) => e.id.toString())).toEqual(['4-0', '3-0', '2-0'])
  })
})

describe('RedisStream.trimMaxLen', () => {
  function seededN(n) {
    const s = new RedisStream()
    for (let i = 1; i <= n; i++) s.add(`${i}-0`, new Map(), i)
    return s
  }

  it('exact trim removes precisely the overflow', () => {
    const s = seededN(10)
    const removed = s.trimMaxLen(7)
    expect(removed).toBe(3)
    expect(s.length).toBe(7)
  })

  it('approx trim below the 64-block threshold removes nothing', () => {
    const s = seededN(70)
    const removed = s.trimMaxLen(50, true)
    expect(removed).toBe(0)
    expect(s.length).toBe(70)
  })

  it('approx trim above the threshold removes in blocks of 64', () => {
    const s = seededN(200)
    const removed = s.trimMaxLen(60, true)
    expect(removed).toBe(128) // floor((200-60)/64)=2 blocks -> 128
    expect(s.length).toBe(72)
  })
})

describe('RedisStream.del', () => {
  it('removes the specified entries and returns the removed count', () => {
    const s = new RedisStream()
    const id1 = s.add('1-0', new Map(), 1)
    s.add('2-0', new Map(), 2)
    const removed = s.del([id1, StreamId.parse('99-0')])
    expect(removed).toBe(1)
    expect(s.length).toBe(1)
  })
})

describe('ConsumerGroup', () => {
  it('createConsumer registers a new consumer once', () => {
    const g = new ConsumerGroup('workers', StreamId.min())
    g.createConsumer('c1', 10)
    g.createConsumer('c1', 20)
    expect(g.consumers.size).toBe(1)
    expect(g.consumers.get('c1').seenTime).toBe(20)
  })

  it('ack removes a present entry from the PEL and the consumer pending set', () => {
    const g = new ConsumerGroup('workers', StreamId.min())
    const id = StreamId.parse('1-0')
    g.createConsumer('c1', 10)
    g.pel.set(id.toString(), { id, consumer: 'c1', deliveryTime: 10, deliveryCount: 1 })
    g.consumers.get('c1').pending.add(id.toString())
    const acked = g.ack([id])
    expect(acked).toBe(1)
    expect(g.pel.size).toBe(0)
    expect(g.consumers.get('c1').pending.size).toBe(0)
  })

  it('ack on an absent id acks nothing', () => {
    const g = new ConsumerGroup('workers', StreamId.min())
    expect(g.ack([StreamId.parse('9-9')])).toBe(0)
  })

  it('claim below min-idle-time claims nothing', () => {
    const g = new ConsumerGroup('workers', StreamId.min())
    const id = StreamId.parse('1-0')
    g.createConsumer('c1', 0)
    g.pel.set(id.toString(), { id, consumer: 'c1', deliveryTime: 0, deliveryCount: 1 })
    const claimed = g.claim([id], 'c2', 500, 1000)
    expect(claimed).toEqual([])
  })

  it('claim above min-idle-time transfers ownership and bumps deliveryCount', () => {
    const g = new ConsumerGroup('workers', StreamId.min())
    const id = StreamId.parse('1-0')
    g.createConsumer('c1', 0)
    g.pel.set(id.toString(), { id, consumer: 'c1', deliveryTime: 0, deliveryCount: 1 })
    const claimed = g.claim([id], 'c2', 2000, 1000)
    expect(claimed.map((i) => i.toString())).toEqual(['1-0'])
    expect(g.pel.get(id.toString()).consumer).toBe('c2')
    expect(g.pel.get(id.toString()).deliveryCount).toBe(2)
    expect(g.consumers.get('c2').pending.has(id.toString())).toBe(true)
  })
})

describe('streamBytes', () => {
  it('grows as entries and fields are added', () => {
    const s = new RedisStream()
    const empty = streamBytes(s)
    s.add('1-0', new Map([['field', 'value']]), 1)
    expect(streamBytes(s)).toBeGreaterThan(empty)
  })

  it('accounts for pending entries across groups', () => {
    const s = new RedisStream()
    const id = s.add('1-0', new Map([['a', 'b']]), 1)
    const before = streamBytes(s)
    const group = new ConsumerGroup('g', StreamId.min())
    group.pel.set(id.toString(), { id, consumer: 'c', deliveryTime: 1, deliveryCount: 1 })
    s.groups.set('g', group)
    expect(streamBytes(s)).toBeGreaterThan(before)
  })
})
