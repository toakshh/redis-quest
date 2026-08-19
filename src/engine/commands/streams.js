import { cmd } from '../registry.js'
import {
  bulkReply,
  integerReply,
  arrayReply,
  emptyArrayReply,
  errorReply,
  wrongType,
  syntaxError,
} from '../reply.js'
import { RedisStream, StreamId } from '../datatypes/Stream.js'

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
