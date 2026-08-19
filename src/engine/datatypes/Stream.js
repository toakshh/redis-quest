// Redis Stream data structure — the storage primitive behind XADD/XRANGE/
// XREADGROUP and friends. Entries are kept in an array in ascending id
// order (true by construction: every accepted id is strictly greater than
// the previous lastId, so appending preserves order — no sort is needed).
// A consumer group tracks its own last-delivered id plus a pending entries
// list (PEL): the teaching object for at-least-once delivery in chapter 3.
//
// Pure data structure — no engine reference, no Date.now(). Every method
// that needs "now" takes it as a parameter from the caller.

import { utf8Bytes } from './memory.js'

export class StreamId {
  constructor(ms, seq) {
    this.ms = ms
    this.seq = seq
  }

  static parse(str) {
    if (str === '-') return StreamId.min()
    if (str === '+') return StreamId.max()
    const m = /^(\d+)(?:-(\d+))?$/.exec(String(str))
    if (!m) {
      throw new Error('ERR Invalid stream ID specified as stream command argument')
    }
    const ms = Number(m[1])
    const seq = m[2] !== undefined ? Number(m[2]) : 0
    return new StreamId(ms, seq)
  }

  static min() {
    return new StreamId(0, 0)
  }

  static max() {
    return new StreamId(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  }

  toString() {
    return `${this.ms}-${this.seq}`
  }

  compare(other) {
    if (this.ms !== other.ms) return this.ms < other.ms ? -1 : 1
    if (this.seq !== other.seq) return this.seq < other.seq ? -1 : 1
    return 0
  }

  isGreaterThan(other) {
    return this.compare(other) > 0
  }
}

export class ConsumerGroup {
  constructor(name, lastDeliveredId) {
    this.name = name
    this.lastDeliveredId = lastDeliveredId
    this.consumers = new Map()
    this.pel = new Map()
  }

  createConsumer(name, nowMs) {
    const existing = this.consumers.get(name)
    if (existing) {
      existing.seenTime = nowMs
      return existing
    }
    const consumer = { name, seenTime: nowMs, pending: new Set() }
    this.consumers.set(name, consumer)
    return consumer
  }

  ack(ids) {
    let count = 0
    for (const id of ids) {
      const key = id.toString()
      const pelEntry = this.pel.get(key)
      if (!pelEntry) continue
      this.pel.delete(key)
      const consumer = this.consumers.get(pelEntry.consumer)
      if (consumer) consumer.pending.delete(key)
      count++
    }
    return count
  }

  claim(ids, toConsumer, nowMs, minIdleMs) {
    const claimed = []
    for (const id of ids) {
      const key = id.toString()
      const pelEntry = this.pel.get(key)
      if (!pelEntry) continue
      const idle = nowMs - pelEntry.deliveryTime
      if (idle < minIdleMs) continue
      const oldConsumer = this.consumers.get(pelEntry.consumer)
      if (oldConsumer) oldConsumer.pending.delete(key)
      pelEntry.consumer = toConsumer
      pelEntry.deliveryTime = nowMs
      pelEntry.deliveryCount += 1
      const consumer = this.createConsumer(toConsumer, nowMs)
      consumer.pending.add(key)
      claimed.push(id)
    }
    return claimed
  }
}

export class RedisStream {
  constructor() {
    this.entries = []
    this.lastId = StreamId.min()
    this.groups = new Map()
    this.maxDeletedId = StreamId.min()
    this.entriesAdded = 0
  }

  get length() {
    return this.entries.length
  }

  _resolveId(idSpec, nowMs) {
    if (idSpec === '*') {
      if (nowMs > this.lastId.ms) return new StreamId(nowMs, 0)
      return new StreamId(this.lastId.ms, this.lastId.seq + 1)
    }
    const partial = /^(\d+)-\*$/.exec(String(idSpec))
    if (partial) {
      const ms = Number(partial[1])
      const seq = this.lastId.ms === ms ? this.lastId.seq + 1 : 0
      return new StreamId(ms, seq)
    }
    return StreamId.parse(idSpec)
  }

  add(idSpec, fieldMap, nowMs) {
    const id = this._resolveId(idSpec, nowMs)
    if (id.compare(this.lastId) <= 0) {
      throw new Error(
        'ERR The ID specified in XADD is equal or smaller than the target stream top item'
      )
    }
    this.entries.push({ id, fields: new Map(fieldMap) })
    this.lastId = id
    this.entriesAdded += 1
    return id
  }

  // Inclusive [startId, endId], ascending. Entries are already sorted by
  // construction, so this is a single forward pass with an early break.
  range(startId, endId, count = Infinity) {
    const out = []
    for (const entry of this.entries) {
      if (entry.id.compare(startId) < 0) continue
      if (entry.id.compare(endId) > 0) break
      out.push(entry)
      if (out.length >= count) break
    }
    return out
  }

  // Same inclusive range as range(), returned in descending id order.
  // Bounds are normalised so callers can pass them in either order.
  revRange(startId, endId, count = Infinity) {
    const lo = startId.compare(endId) <= 0 ? startId : endId
    const hi = startId.compare(endId) <= 0 ? endId : startId
    const out = []
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]
      if (entry.id.compare(hi) > 0) continue
      if (entry.id.compare(lo) < 0) break
      out.push(entry)
      if (out.length >= count) break
    }
    return out
  }

  trimMaxLen(maxLen, approx = false) {
    const over = this.entries.length - maxLen
    if (over <= 0) return 0
    let removeCount
    if (approx) {
      const blocks = Math.floor(over / 64)
      if (blocks === 0) return 0
      removeCount = blocks * 64
    } else {
      removeCount = over
    }
    this.entries.splice(0, removeCount)
    return removeCount
  }

  del(ids) {
    let count = 0
    for (const id of ids) {
      const idx = this.entries.findIndex((entry) => entry.id.compare(id) === 0)
      if (idx === -1) continue
      this.entries.splice(idx, 1)
      if (id.isGreaterThan(this.maxDeletedId)) this.maxDeletedId = id
      count++
    }
    return count
  }
}

export function streamBytes(stream) {
  let total = stream.entries.length * 64
  for (const entry of stream.entries) {
    for (const [field, value] of entry.fields) {
      total += utf8Bytes(field) + utf8Bytes(value)
    }
  }
  for (const group of stream.groups.values()) {
    total += group.pel.size * 48
  }
  return total
}
