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
  syntaxError,
} from '../reply.js'
import { RedisStream, StreamId, ConsumerGroup } from '../datatypes/Stream.js'

// Fetch the stream under `key`, creating one if missing. Mirrors
// listForWrite in lists.js: element ops preserve an existing TTL.
function streamForWrite(engine, key) {
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'stream')
  if (wt) return { wrongType: true }
  if (created) entry.value = new RedisStream()
  return { entry }
}

// The real nested RESP shape: [id, [field, value, field, value, ...]].
function entryToReply(entry) {
  const fields = []
  for (const [field, value] of entry.fields) {
    fields.push(bulkReply(field), bulkReply(value))
  }
  return arrayReply([bulkReply(entry.id.toString()), arrayReply(fields)])
}

function noGroupError(groupName, key) {
  return errorReply(`NOGROUP No such consumer group '${groupName}' for key name '${key}'`)
}

// Shared by XRANGE/XREVRANGE: key, start, end, optional COUNT n.
function parseRangeArgs(args) {
  const key = args[1]
  let count = Infinity
  if (args.length > 4) {
    if (args.length !== 6 || String(args[4]).toUpperCase() !== 'COUNT') return { error: true }
    const n = Number(args[5])
    if (!Number.isInteger(n) || n < 0) return { error: true }
    count = n
  }
  let startId
  let endId
  try {
    startId = StreamId.parse(args[2])
    endId = StreamId.parse(args[3])
  } catch (err) {
    return { error: true, message: err.message }
  }
  return { key, startId, endId, count }
}

export const XADD = cmd({
  arity: -5,
  syntax: 'XADD key [MAXLEN [~] count] <*|id> field value [field value ...]',
  summary: 'Append an entry to a stream, creating it if needed.',
  group: 'streams',
  examples: ['XADD orders * item "widget" qty "3"'],
})((engine, args) => {
  const key = args[1]
  let i = 2
  let maxLen = null
  let approx = false

  if (String(args[i]).toUpperCase() === 'MAXLEN') {
    i += 1
    if (args[i] === '~') {
      approx = true
      i += 1
    } else if (args[i] === '=') {
      i += 1
    }
    const parsedMaxLen = Number(args[i])
    if (!Number.isInteger(parsedMaxLen) || parsedMaxLen < 0) return syntaxError()
    maxLen = parsedMaxLen
    i += 1
  }

  const idSpec = args[i]
  i += 1
  const fieldArgs = args.slice(i)
  if (fieldArgs.length === 0 || fieldArgs.length % 2 !== 0) return syntaxError()

  const { entry, wrongType: wt } = streamForWrite(engine, key)
  if (wt) return wrongType()

  const fieldMap = new Map()
  for (let f = 0; f < fieldArgs.length; f += 2) {
    fieldMap.set(String(fieldArgs[f]), String(fieldArgs[f + 1]))
  }

  let id
  try {
    id = entry.value.add(idSpec, fieldMap, engine.now())
  } catch (err) {
    return errorReply(err.message)
  }

  if (maxLen !== null) entry.value.trimMaxLen(maxLen, approx)

  engine._bump(key, entry)
  engine.emit('change')
  return bulkReply(id.toString())
})

export const XLEN = cmd({
  arity: 2,
  syntax: 'XLEN key',
  summary: 'Return the number of entries in a stream.',
  group: 'streams',
  examples: ['XLEN orders'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'stream') return wrongType()
  return integerReply(entry.value.length)
})

export const XRANGE = cmd({
  arity: -4,
  syntax: 'XRANGE key start end [COUNT n]',
  summary: 'Return stream entries between two ids, ascending.',
  group: 'streams',
  examples: ['XRANGE orders - +'],
})((engine, args) => {
  const parsed = parseRangeArgs(args)
  if (parsed.error) return parsed.message ? errorReply(parsed.message) : syntaxError()
  const entry = engine._get(parsed.key)
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'stream') return wrongType()
  const entries = entry.value.range(parsed.startId, parsed.endId, parsed.count)
  return arrayReply(entries.map(entryToReply))
})

export const XREVRANGE = cmd({
  arity: -4,
  syntax: 'XREVRANGE key end start [COUNT n]',
  summary: 'Return stream entries between two ids, descending.',
  group: 'streams',
  examples: ['XREVRANGE orders + -'],
})((engine, args) => {
  const parsed = parseRangeArgs(args)
  if (parsed.error) return parsed.message ? errorReply(parsed.message) : syntaxError()
  const entry = engine._get(parsed.key)
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'stream') return wrongType()
  const entries = entry.value.revRange(parsed.startId, parsed.endId, parsed.count)
  return arrayReply(entries.map(entryToReply))
})

export const XDEL = cmd({
  arity: -3,
  syntax: 'XDEL key id [id ...]',
  summary: 'Remove one or more entries from a stream by id.',
  group: 'streams',
  examples: ['XDEL orders 1-0'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'stream') return wrongType()

  let ids
  try {
    ids = args.slice(2).map((s) => StreamId.parse(s))
  } catch (err) {
    return errorReply(err.message)
  }

  const removed = entry.value.del(ids)
  if (removed > 0) {
    engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(removed)
})

export const XGROUP = cmd({
  arity: -4,
  syntax:
    'XGROUP CREATE key group <id|$> [MKSTREAM] | XGROUP DESTROY key group | XGROUP CREATECONSUMER key group consumer | XGROUP DELCONSUMER key group consumer',
  summary: 'Manage consumer groups on a stream.',
  group: 'streams',
  examples: ['XGROUP CREATE orders workers $ MKSTREAM'],
})((engine, args) => {
  const sub = String(args[1]).toUpperCase()
  const key = args[2]
  const groupName = args[3]

  if (sub === 'CREATE') {
    const idArg = args[4]
    const mkstream = String(args[5] || '').toUpperCase() === 'MKSTREAM'
    let entry = engine._get(key)
    if (!entry) {
      if (!mkstream) {
        return errorReply(
          'ERR The XGROUP subcommand requires the key to exist. Note that for CREATE you may want to use the MKSTREAM option to create an empty stream automatically.'
        )
      }
      entry = streamForWrite(engine, key).entry
    }
    if (entry.type !== 'stream') return wrongType()

    let lastDeliveredId
    if (idArg === '$') {
      lastDeliveredId = entry.value.lastId
    } else if (idArg === '0') {
      lastDeliveredId = StreamId.min()
    } else {
      try {
        lastDeliveredId = StreamId.parse(idArg)
      } catch (err) {
        return errorReply(err.message)
      }
    }

    if (entry.value.groups.has(groupName)) {
      return errorReply('BUSYGROUP Consumer Group name already exists')
    }
    entry.value.groups.set(groupName, new ConsumerGroup(groupName, lastDeliveredId))
    engine._bump(key, entry)
    return okReply()
  }

  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)

  if (sub === 'DESTROY') {
    if (!group) return integerReply(0)
    entry.value.groups.delete(groupName)
    return integerReply(1)
  }

  if (sub === 'CREATECONSUMER') {
    if (!group) return noGroupError(groupName, key)
    const consumerName = args[4]
    if (group.consumers.has(consumerName)) return integerReply(0)
    group.createConsumer(consumerName, engine.now())
    return integerReply(1)
  }

  if (sub === 'DELCONSUMER') {
    if (!group) return noGroupError(groupName, key)
    const consumerName = args[4]
    const consumer = group.consumers.get(consumerName)
    if (!consumer) return integerReply(0)
    const pendingCount = consumer.pending.size
    for (const idKey of consumer.pending) group.pel.delete(idKey)
    group.consumers.delete(consumerName)
    return integerReply(pendingCount)
  }

  return syntaxError()
})

export const XREADGROUP = cmd({
  arity: -7,
  syntax: 'XREADGROUP GROUP group consumer [COUNT n] [NOACK] STREAMS key <>|id>',
  summary: 'Read new or pending entries from a stream as a consumer group member.',
  group: 'streams',
  examples: ['XREADGROUP GROUP workers c1 COUNT 10 STREAMS orders >'],
})((engine, args) => {
  let i = 1
  if (String(args[i]).toUpperCase() !== 'GROUP') return syntaxError()
  i += 1
  const groupName = args[i]
  i += 1
  const consumerName = args[i]
  i += 1

  let count = Infinity
  let noAck = false
  while (i < args.length && String(args[i]).toUpperCase() !== 'STREAMS') {
    const flag = String(args[i]).toUpperCase()
    if (flag === 'COUNT') {
      i += 1
      const n = Number(args[i])
      if (!Number.isInteger(n) || n < 0) return syntaxError()
      count = n
      i += 1
    } else if (flag === 'NOACK') {
      noAck = true
      i += 1
    } else {
      return syntaxError()
    }
  }
  if (String(args[i]).toUpperCase() !== 'STREAMS') return syntaxError()
  i += 1
  const remaining = args.slice(i)
  if (remaining.length !== 2) return syntaxError()
  const [key, idArg] = remaining

  const entry = engine._get(key)
  if (!entry) return noGroupError(groupName, key)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)
  if (!group) return noGroupError(groupName, key)
  const consumer = group.createConsumer(consumerName, engine.now())

  if (idArg === '>') {
    const delivered = []
    for (const streamEntry of entry.value.entries) {
      if (streamEntry.id.compare(group.lastDeliveredId) <= 0) continue
      delivered.push(streamEntry)
      if (delivered.length >= count) break
    }
    if (delivered.length === 0) return nilReply()
    for (const streamEntry of delivered) {
      group.lastDeliveredId = streamEntry.id
      if (!noAck) {
        const idKey = streamEntry.id.toString()
        group.pel.set(idKey, {
          id: streamEntry.id,
          consumer: consumerName,
          deliveryTime: engine.now(),
          deliveryCount: 1,
        })
        consumer.pending.add(idKey)
      }
    }
    return arrayReply([arrayReply([bulkReply(key), arrayReply(delivered.map(entryToReply))])])
  }

  // Explicit id: replay this consumer's own already-pending entries greater
  // than idArg. Does NOT deliver new entries and does NOT advance
  // lastDeliveredId — that is what makes this a replay, not a read.
  let givenId
  try {
    givenId = StreamId.parse(idArg)
  } catch (err) {
    return errorReply(err.message)
  }
  const candidates = []
  for (const idKey of consumer.pending) {
    const pelEntry = group.pel.get(idKey)
    if (!pelEntry) continue
    if (pelEntry.id.compare(givenId) <= 0) continue
    candidates.push(pelEntry)
  }
  candidates.sort((a, b) => a.id.compare(b.id))
  const limited = count === Infinity ? candidates : candidates.slice(0, count)
  const results = []
  for (const pelEntry of limited) {
    const streamEntry = entry.value.entries.find((e) => e.id.compare(pelEntry.id) === 0)
    if (streamEntry) results.push(streamEntry)
  }
  return arrayReply([arrayReply([bulkReply(key), arrayReply(results.map(entryToReply))])])
})

export const XACK = cmd({
  arity: -4,
  syntax: 'XACK key group id [id ...]',
  summary: 'Acknowledge one or more pending entries in a consumer group.',
  group: 'streams',
  examples: ['XACK orders workers 1-0'],
})((engine, args) => {
  const key = args[1]
  const groupName = args[2]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)
  if (!group) return integerReply(0)

  let ids
  try {
    ids = args.slice(3).map((s) => StreamId.parse(s))
  } catch (err) {
    return errorReply(err.message)
  }
  return integerReply(group.ack(ids))
})

export const XPENDING = cmd({
  arity: -3,
  syntax: 'XPENDING key group [start end count [consumer]]',
  summary: 'Inspect the pending entries list for a consumer group.',
  group: 'streams',
  examples: ['XPENDING orders workers'],
})((engine, args) => {
  const key = args[1]
  const groupName = args[2]
  const entry = engine._get(key)
  if (!entry) return noGroupError(groupName, key)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)
  if (!group) return noGroupError(groupName, key)

  if (args.length === 3) {
    if (group.pel.size === 0) {
      return arrayReply([integerReply(0), nilReply(), nilReply(), nilReply()])
    }
    const ids = [...group.pel.values()].map((e) => e.id)
    let minId = ids[0]
    let maxId = ids[0]
    for (const id of ids) {
      if (id.compare(minId) < 0) minId = id
      if (id.compare(maxId) > 0) maxId = id
    }
    const counts = new Map()
    for (const e of group.pel.values()) counts.set(e.consumer, (counts.get(e.consumer) || 0) + 1)
    const consumerPairs = [...counts.entries()].map(([c, n]) =>
      arrayReply([bulkReply(c), bulkReply(String(n))])
    )
    return arrayReply([
      integerReply(group.pel.size),
      bulkReply(minId.toString()),
      bulkReply(maxId.toString()),
      arrayReply(consumerPairs),
    ])
  }

  if (args.length < 6) return syntaxError()
  let startId
  let endId
  try {
    startId = StreamId.parse(args[3])
    endId = StreamId.parse(args[4])
  } catch (err) {
    return errorReply(err.message)
  }
  const limitCount = Number(args[5])
  if (!Number.isInteger(limitCount) || limitCount < 0) return syntaxError()
  const consumerFilter = args[6]

  const matches = [...group.pel.values()]
    .filter(
      (e) =>
        e.id.compare(startId) >= 0 &&
        e.id.compare(endId) <= 0 &&
        (!consumerFilter || e.consumer === consumerFilter)
    )
    .sort((a, b) => a.id.compare(b.id))
    .slice(0, limitCount)

  return arrayReply(
    matches.map((e) =>
      arrayReply([
        bulkReply(e.id.toString()),
        bulkReply(e.consumer),
        integerReply(engine.now() - e.deliveryTime),
        integerReply(e.deliveryCount),
      ])
    )
  )
})

export const XCLAIM = cmd({
  arity: -6,
  syntax: 'XCLAIM key group consumer min-idle-time id [id ...]',
  summary: 'Transfer ownership of pending entries to another consumer.',
  group: 'streams',
  examples: ['XCLAIM orders workers c2 1000 1-0'],
})((engine, args) => {
  const key = args[1]
  const groupName = args[2]
  const consumerName = args[3]
  const minIdle = Number(args[4])
  if (!Number.isInteger(minIdle) || minIdle < 0) return syntaxError()

  const entry = engine._get(key)
  if (!entry) return noGroupError(groupName, key)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)
  if (!group) return noGroupError(groupName, key)

  let ids
  try {
    ids = args.slice(5).map((s) => StreamId.parse(s))
  } catch (err) {
    return errorReply(err.message)
  }

  const claimed = group.claim(ids, consumerName, engine.now(), minIdle)
  const results = claimed
    .map((id) => entry.value.entries.find((e) => e.id.compare(id) === 0))
    .filter(Boolean)
  return arrayReply(results.map(entryToReply))
})

export const XAUTOCLAIM = cmd({
  arity: -7,
  syntax: 'XAUTOCLAIM key group consumer min-idle-time start [COUNT n]',
  summary: 'Auto-claim idle pending entries at or after start, in id order.',
  group: 'streams',
  examples: ['XAUTOCLAIM orders workers c2 1000 0 COUNT 50'],
})((engine, args) => {
  const key = args[1]
  const groupName = args[2]
  const consumerName = args[3]
  const minIdle = Number(args[4])
  if (!Number.isInteger(minIdle) || minIdle < 0) return syntaxError()

  let startId
  try {
    startId = StreamId.parse(args[5])
  } catch (err) {
    return errorReply(err.message)
  }

  let count = 100
  if (args.length > 6) {
    if (String(args[6]).toUpperCase() !== 'COUNT') return syntaxError()
    const n = Number(args[7])
    if (!Number.isInteger(n) || n < 0) return syntaxError()
    count = n
  }

  const entry = engine._get(key)
  if (!entry) return noGroupError(groupName, key)
  if (entry.type !== 'stream') return wrongType()
  const group = entry.value.groups.get(groupName)
  if (!group) return noGroupError(groupName, key)

  const candidates = [...group.pel.values()]
    .filter((e) => e.id.compare(startId) >= 0)
    .sort((a, b) => a.id.compare(b.id))
  const batch = candidates.slice(0, count)
  const remaining = candidates.slice(batch.length)
  const nextCursor = remaining.length > 0 ? remaining[0].id : StreamId.min()

  const claimedIds = group.claim(batch.map((e) => e.id), consumerName, engine.now(), minIdle)
  const resultEntries = []
  const deletedIds = []
  for (const id of claimedIds) {
    const streamEntry = entry.value.entries.find((e) => e.id.compare(id) === 0)
    if (streamEntry) {
      resultEntries.push(streamEntry)
    } else {
      deletedIds.push(id)
      group.pel.delete(id.toString())
    }
  }

  return arrayReply([
    bulkReply(nextCursor.toString()),
    arrayReply(resultEntries.map(entryToReply)),
    arrayReply(deletedIds.map((id) => bulkReply(id.toString()))),
  ])
})

export const XINFO = cmd({
  arity: -3,
  syntax: 'XINFO STREAM key | XINFO GROUPS key | XINFO CONSUMERS key group',
  summary: "Return introspection data about a stream, its groups, or a group's consumers.",
  group: 'streams',
  examples: ['XINFO STREAM orders', 'XINFO GROUPS orders'],
})((engine, args) => {
  const sub = String(args[1]).toUpperCase()
  const key = args[2]
  const entry = engine._get(key)
  if (!entry) return errorReply('ERR no such key')
  if (entry.type !== 'stream') return wrongType()

  if (sub === 'STREAM') {
    return arrayReply([
      bulkReply('length'),
      integerReply(entry.value.length),
      bulkReply('last-generated-id'),
      bulkReply(entry.value.lastId.toString()),
      bulkReply('groups'),
      integerReply(entry.value.groups.size),
    ])
  }

  if (sub === 'GROUPS') {
    const out = []
    for (const group of entry.value.groups.values()) {
      out.push(
        arrayReply([
          bulkReply('name'),
          bulkReply(group.name),
          bulkReply('consumers'),
          integerReply(group.consumers.size),
          bulkReply('pending'),
          integerReply(group.pel.size),
          bulkReply('last-delivered-id'),
          bulkReply(group.lastDeliveredId.toString()),
        ])
      )
    }
    return arrayReply(out)
  }

  if (sub === 'CONSUMERS') {
    const groupName = args[3]
    const group = entry.value.groups.get(groupName)
    if (!group) return noGroupError(groupName, key)
    const out = []
    for (const consumer of group.consumers.values()) {
      out.push(
        arrayReply([
          bulkReply('name'),
          bulkReply(consumer.name),
          bulkReply('pending'),
          integerReply(consumer.pending.size),
        ])
      )
    }
    return arrayReply(out)
  }

  return syntaxError()
})
