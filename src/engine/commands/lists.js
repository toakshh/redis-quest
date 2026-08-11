import { cmd } from '../registry.js'
import {
  okReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  emptyArrayReply,
  errorReply,
  wrongType,
  invalidInt,
  intValue,
} from '../reply.js'
import { LinkedList } from '../datatypes/LinkedList.js'

// Fetch the list under `key`, creating one if missing. Shared by the push
// commands so they all preserve an existing TTL (element ops do not touch
// expiresAt, matching real Redis).
function listForWrite(engine, key) {
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'list')
  if (wt) return { wrongType: true }
  if (created) entry.value = new LinkedList()
  return { entry }
}

// Normalize a start/stop pair to inclusive bounds, Redis-style: negative
// indexes count from the tail, out-of-range ends are clamped. Returns null
// when the range is empty.
function normalizeRange(start, stop, len) {
  if (start < 0) start = len + start
  if (stop < 0) stop = len + stop
  if (start < 0) start = 0
  if (stop >= len) stop = len - 1
  if (start > stop || start >= len) return null
  return { start, stop }
}

// Removal commands delete the key once the list drains, like real Redis.
function afterRemoval(engine, key, entry) {
  if (entry.value.length === 0) engine._delete(key)
  else engine._bump(key, entry)
  engine.emit('change')
}

export const LPUSH = cmd({
  arity: -3,
  syntax: 'LPUSH key value [value ...]',
  summary: 'Prepend one or more values to a list, creating it if needed.',
  group: 'lists',
  examples: ['LPUSH tasks "write report" "review code"'],
})((engine, args) => {
  const key = args[1]
  const values = args.slice(2)
  const { entry, wrongType: wt } = listForWrite(engine, key)
  if (wt) return wrongType()
  for (const value of values) entry.value.pushFront(String(value))
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(entry.value.length)
})

export const RPUSH = cmd({
  arity: -3,
  syntax: 'RPUSH key value [value ...]',
  summary: 'Append one or more values to a list, creating it if needed.',
  group: 'lists',
  examples: ['RPUSH queue "job 1" "job 2"'],
})((engine, args) => {
  const key = args[1]
  const values = args.slice(2)
  const { entry, wrongType: wt } = listForWrite(engine, key)
  if (wt) return wrongType()
  for (const value of values) entry.value.pushBack(String(value))
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(entry.value.length)
})

export const LPOP = cmd({
  arity: -2,
  syntax: 'LPOP key [count]',
  summary: 'Remove and return the first element(s) of a list.',
  group: 'lists',
  examples: ['LPOP queue', 'LPOP queue 3'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return args.length > 2 ? emptyArrayReply() : nilReply()
  if (entry.type !== 'list') return wrongType()
  if (args.length > 2) {
    const count = intValue(args[2])
    if (count === null) return invalidInt(args[2])
    if (count < 0) return errorReply('ERR value is out of range, must be positive')
    const out = []
    for (let i = 0; i < count && entry.value.length > 0; i++) {
      out.push(bulkReply(entry.value.popFront()))
    }
    if (out.length > 0) afterRemoval(engine, key, entry)
    return arrayReply(out)
  }
  const value = entry.value.popFront()
  if (value === null) return nilReply()
  afterRemoval(engine, key, entry)
  return bulkReply(value)
})

export const RPOP = cmd({
  arity: -2,
  syntax: 'RPOP key [count]',
  summary: 'Remove and return the last element(s) of a list.',
  group: 'lists',
  examples: ['RPOP queue', 'RPOP queue 3'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return args.length > 2 ? emptyArrayReply() : nilReply()
  if (entry.type !== 'list') return wrongType()
  if (args.length > 2) {
    const count = intValue(args[2])
    if (count === null) return invalidInt(args[2])
    if (count < 0) return errorReply('ERR value is out of range, must be positive')
    const out = []
    for (let i = 0; i < count && entry.value.length > 0; i++) {
      out.push(bulkReply(entry.value.popBack()))
    }
    if (out.length > 0) afterRemoval(engine, key, entry)
    return arrayReply(out)
  }
  const value = entry.value.popBack()
  if (value === null) return nilReply()
  afterRemoval(engine, key, entry)
  return bulkReply(value)
})

export const LLEN = cmd({
  arity: 2,
  syntax: 'LLEN key',
  summary: 'Get the length of a list.',
  group: 'lists',
  examples: ['LLEN queue'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'list') return wrongType()
  return integerReply(entry.value.length)
})

export const LRANGE = cmd({
  arity: 4,
  syntax: 'LRANGE key start stop',
  summary: 'Get a range of elements from a list (inclusive, negative from tail).',
  group: 'lists',
  examples: ['LRANGE queue 0 -1'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'list') return wrongType()
  const start = intValue(args[2])
  const stop = intValue(args[3])
  if (start === null || stop === null) return invalidInt(start === null ? args[2] : args[3])
  const range = normalizeRange(start, stop, entry.value.length)
  if (!range) return emptyArrayReply()
  const values = entry.value.toArray()
  const out = []
  for (let i = range.start; i <= range.stop; i++) out.push(bulkReply(values[i]))
  return arrayReply(out)
})

export const LINDEX = cmd({
  arity: 3,
  syntax: 'LINDEX key index',
  summary: 'Get an element of a list by its index (negative from tail).',
  group: 'lists',
  examples: ['LINDEX queue 0'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return nilReply()
  if (entry.type !== 'list') return wrongType()
  const index = intValue(args[2])
  if (index === null) return invalidInt(args[2])
  const value = entry.value.valueAt(index)
  return value === null ? nilReply() : bulkReply(value)
})

export const LSET = cmd({
  arity: 4,
  syntax: 'LSET key index value',
  summary: 'Set the value of a list element at a given index.',
  group: 'lists',
  examples: ['LSET queue 0 "urgent"'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return errorReply('ERR no such key')
  if (entry.type !== 'list') return wrongType()
  const index = intValue(args[2])
  if (index === null) return invalidInt(args[2])
  const node = entry.value.nodeAt(index)
  if (!node) return errorReply('ERR index out of range')
  node.value = String(args[3])
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const LREM = cmd({
  arity: 4,
  syntax: 'LREM key count value',
  summary: 'Remove occurrences of a value from a list (count 0 = all).',
  group: 'lists',
  examples: ['LREM queue 2 "job 1"'],
})((engine, args) => {
  const key = args[1]
  const count = intValue(args[2])
  if (count === null) return invalidInt(args[2])
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'list') return wrongType()
  const target = String(args[3])
  const list = entry.value
  let removed = 0
  if (count >= 0) {
    const limit = count === 0 ? Infinity : count
    let n = list.head
    while (n && removed < limit) {
      const next = n.next
      if (n.value === target) {
        list.remove(n)
        removed++
      }
      n = next
    }
  } else {
    const limit = -count
    let n = list.tail
    while (n && removed < limit) {
      const prev = n.prev
      if (n.value === target) {
        list.remove(n)
        removed++
      }
      n = prev
    }
  }
  if (removed > 0) afterRemoval(engine, key, entry)
  return integerReply(removed)
})

export const LTRIM = cmd({
  arity: 4,
  syntax: 'LTRIM key start stop',
  summary: 'Trim a list to the specified inclusive range.',
  group: 'lists',
  examples: ['LTRIM log 0 99'],
})((engine, args) => {
  const key = args[1]
  const start = intValue(args[2])
  const stop = intValue(args[3])
  if (start === null || stop === null) return invalidInt(start === null ? args[2] : args[3])
  const entry = engine._get(key)
  if (!entry) return okReply()
  if (entry.type !== 'list') return wrongType()
  const range = normalizeRange(start, stop, entry.value.length)
  if (!range) {
    engine._delete(key)
    engine.emit('change')
    return okReply()
  }
  const list = entry.value
  for (let i = 0; i < range.start; i++) list.popFront()
  while (list.length > range.stop - range.start + 1) list.popBack()
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const RPOPLPUSH = cmd({
  arity: 3,
  syntax: 'RPOPLPUSH source destination',
  summary: 'Pop the last element of source and push it to the head of destination.',
  group: 'lists',
  examples: ['RPOPLPUSH backup queue'],
})((engine, args) => {
  const src = args[1]
  const dst = args[2]
  const srcEntry = engine._get(src)
  if (!srcEntry) return nilReply()
  if (srcEntry.type !== 'list') return wrongType()

  // Guard the destination before mutating the source so a type clash is a no-op.
  if (src !== dst) {
    const dstEntry = engine._get(dst)
    if (dstEntry && dstEntry.type !== 'list') return wrongType()
  }

  const value = srcEntry.value.popBack()
  if (value === null) return nilReply()

  if (src === dst) {
    // rotation: tail element moves to the head of the same list
    srcEntry.value.pushFront(value)
    engine._bump(src, srcEntry)
    engine.emit('change')
    return bulkReply(value)
  }

  afterRemoval(engine, src, srcEntry)
  const { entry, wrongType: wt } = listForWrite(engine, dst)
  if (wt) return wrongType()
  entry.value.pushFront(value)
  engine._bump(dst, entry)
  engine.emit('change')
  return bulkReply(value)
})
