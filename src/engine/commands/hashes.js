import { cmd } from '../registry.js'
import { Dict } from '../datatypes/Dict.js'
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
  invalidFloat,
  intValue,
} from '../reply.js'

export const HSET = cmd({
  arity: -4,
  syntax: 'HSET key field value [field value ...]',
  summary: 'Set the string value of one or more hash fields.',
  group: 'hashes',
  examples: ['HSET user:1 name Alice', 'HSET user:1 name Alice age 30'],
})((engine, args) => {
  const [, key, ...rest] = args
  if (rest.length % 2 !== 0) {
    return errorReply("ERR wrong number of arguments for 'hset' command")
  }
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'hash')
  if (wt) return wrongType()
  if (created) entry.value = new Dict()
  let added = 0
  for (let i = 0; i < rest.length; i += 2) {
    const field = rest[i]
    if (!entry.value.has(field)) added++
    entry.value.set(field, String(rest[i + 1]))
  }
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(added)
})

export const HGET = cmd({
  arity: 3,
  syntax: 'HGET key field',
  summary: 'Get the value of a hash field.',
  group: 'hashes',
  examples: ['HGET user:1 name'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return nilReply()
  if (entry.type !== 'hash') return wrongType()
  const value = entry.value.get(args[2])
  return value === undefined ? nilReply() : bulkReply(value)
})

export const HDEL = cmd({
  arity: -3,
  syntax: 'HDEL key field [field ...]',
  summary: 'Delete one or more hash fields; deletes the key if the last field goes.',
  group: 'hashes',
  examples: ['HDEL user:1 name', 'HDEL user:1 name age'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'hash') return wrongType()
  let removed = 0
  for (const field of args.slice(2)) {
    if (entry.value.delete(field)) removed++
  }
  if (removed > 0) {
    if (entry.value.size === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(removed)
})

export const HEXISTS = cmd({
  arity: 3,
  syntax: 'HEXISTS key field',
  summary: 'Determine if a hash field exists.',
  group: 'hashes',
  examples: ['HEXISTS user:1 name'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'hash') return wrongType()
  return integerReply(entry.value.has(args[2]) ? 1 : 0)
})

export const HGETALL = cmd({
  arity: 2,
  syntax: 'HGETALL key',
  summary: 'Get all fields and values in a hash.',
  group: 'hashes',
  examples: ['HGETALL user:1'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'hash') return wrongType()
  const out = []
  for (const [field, value] of entry.value.entries()) {
    out.push(bulkReply(field), bulkReply(value))
  }
  return arrayReply(out)
})

export const HKEYS = cmd({
  arity: 2,
  syntax: 'HKEYS key',
  summary: 'Get all the fields in a hash.',
  group: 'hashes',
  examples: ['HKEYS user:1'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'hash') return wrongType()
  return arrayReply(entry.value.keys().map((field) => bulkReply(field)))
})

export const HVALS = cmd({
  arity: 2,
  syntax: 'HVALS key',
  summary: 'Get all the values in a hash.',
  group: 'hashes',
  examples: ['HVALS user:1'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'hash') return wrongType()
  return arrayReply(entry.value.values().map((value) => bulkReply(value)))
})

export const HLEN = cmd({
  arity: 2,
  syntax: 'HLEN key',
  summary: 'Get the number of fields in a hash.',
  group: 'hashes',
  examples: ['HLEN user:1'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'hash') return wrongType()
  return integerReply(entry.value.size)
})

export const HMSET = cmd({
  arity: -4,
  syntax: 'HMSET key field value [field value ...]',
  summary: 'Set multiple hash fields to multiple values.',
  group: 'hashes',
  examples: ['HMSET user:1 name Alice age 30'],
})((engine, args) => {
  const [, key, ...rest] = args
  if (rest.length % 2 !== 0) {
    return errorReply("ERR wrong number of arguments for 'hmset' command")
  }
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'hash')
  if (wt) return wrongType()
  if (created) entry.value = new Dict()
  for (let i = 0; i < rest.length; i += 2) {
    entry.value.set(rest[i], String(rest[i + 1]))
  }
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const HMGET = cmd({
  arity: -3,
  syntax: 'HMGET key field [field ...]',
  summary: 'Get the values of all the given hash fields.',
  group: 'hashes',
  examples: ['HMGET user:1 name age'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (entry && entry.type !== 'hash') return wrongType()
  const out = []
  for (const field of args.slice(2)) {
    if (!entry) {
      out.push(nilReply())
    } else {
      const value = entry.value.get(field)
      out.push(value === undefined ? nilReply() : bulkReply(value))
    }
  }
  return arrayReply(out)
})

export const HINCRBY = cmd({
  arity: 4,
  syntax: 'HINCRBY key field increment',
  summary: 'Increment the integer value of a hash field by the given number.',
  group: 'hashes',
  examples: ['HINCRBY user:1 visits 5'],
})((engine, args) => {
  const [, key, field, increment] = args
  const inc = intValue(increment)
  if (inc === null) return invalidInt(increment)
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'hash')
  if (wt) return wrongType()
  if (created) entry.value = new Dict()
  const raw = entry.value.get(field)
  let base = 0
  if (raw !== undefined) {
    if (!/^-?\d+$/.test(raw)) return errorReply('ERR hash value is not an integer')
    base = Number(raw)
  }
  const result = base + inc
  if (!Number.isSafeInteger(result)) {
    return errorReply('ERR increment or decrement would overflow')
  }
  entry.value.set(field, String(result))
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(result)
})

export const HINCRBYFLOAT = cmd({
  arity: 4,
  syntax: 'HINCRBYFLOAT key field increment',
  summary: 'Increment the float value of a hash field by the given amount.',
  group: 'hashes',
  examples: ['HINCRBYFLOAT user:1 score 0.5'],
})((engine, args) => {
  const [, key, field, increment] = args
  const inc = parseFloatArg(increment)
  if (inc === null) return invalidFloat(increment)
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'hash')
  if (wt) return wrongType()
  if (created) entry.value = new Dict()
  const raw = entry.value.get(field)
  let base = 0
  if (raw !== undefined) {
    const parsed = parseFloatArg(raw)
    if (parsed === null) return errorReply('ERR hash value is not a float')
    base = parsed
  }
  const result = base + inc
  if (!Number.isFinite(result)) {
    return errorReply('ERR increment would produce NaN or Infinity')
  }
  const formatted = formatFloat(result)
  entry.value.set(field, formatted)
  engine._bump(key, entry)
  engine.emit('change')
  return bulkReply(formatted)
})

export const HSETNX = cmd({
  arity: 4,
  syntax: 'HSETNX key field value',
  summary: 'Set the value of a hash field only if the field does not exist.',
  group: 'hashes',
  examples: ['HSETNX user:1 name Alice'],
})((engine, args) => {
  const [, key, field, value] = args
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'hash')
  if (wt) return wrongType()
  if (created) entry.value = new Dict()
  if (entry.value.has(field)) return integerReply(0)
  entry.value.set(field, String(value))
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(1)
})

function parseFloatArg(arg) {
  if (typeof arg !== 'string' || arg === '') return null
  const n = Number(arg)
  return Number.isNaN(n) ? null : n
}

// Format a float the way redis ld2string does in human mode (%.17Lf with
// trailing zeros trimmed). We round to 15 significant digits first because JS
// computes in IEEE doubles while redis uses long doubles, so naive sums like
// 0.1 + 0.2 would otherwise print their binary noise (…004).
function formatFloat(value) {
  const rounded = Number(value.toPrecision(15))
  let s = rounded.toString()
  // toString() falls back to exponent notation outside ~1e-6..1e21; expand it.
  if (s.indexOf('e') !== -1) s = expandExponent(s)
  return s
}

function expandExponent(s) {
  const [mantissa, expStr] = s.split('e')
  const exp = parseInt(expStr, 10)
  const neg = mantissa.startsWith('-')
  const digits = neg ? mantissa.slice(1) : mantissa
  const [intPart, fracPart = ''] = digits.split('.')
  const point = intPart.length + exp
  const all = intPart + fracPart
  if (point <= 0) {
    return (neg ? '-0.' : '0.') + '0'.repeat(-point) + all
  }
  if (point >= all.length) {
    return (neg ? '-' : '') + all + '0'.repeat(point - all.length)
  }
  return (neg ? '-' : '') + all.slice(0, point) + '.' + all.slice(point)
}
