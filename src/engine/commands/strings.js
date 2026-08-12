import { cmd } from '../registry.js'
import {
  okReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  errorReply,
  wrongType,
  syntaxError,
  invalidInt,
  invalidExpire,
  intValue,
} from '../reply.js'

const str = (key) => (key === 'strings' ? 'STRINGS' : key)

export const SET = cmd({
  arity: -3,
  syntax: 'SET key value [EX seconds] [PX milliseconds] [NX|XX]',
  summary: 'Set the string value of a key, with optional expiration and NX/XX guards.',
  group: 'strings',
  examples: ['SET name "Ada Lovelace"', 'SET token abc123 EX 60 NX'],
})((engine, args) => {
  const [key, value, ...opts] = args.slice(1)

  // Parse options: EX/PX take a value; NX/XX are zero-arg flags.
  let nxFlag = false
  let xxFlag = false
  let exSec = null
  let pxMs = null
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i].toUpperCase()
    if (o === 'NX') {
      if (nxFlag || xxFlag) return syntaxError()
      nxFlag = true
    } else if (o === 'XX') {
      if (nxFlag || xxFlag) return syntaxError()
      xxFlag = true
    } else if (o === 'EX') {
      if (exSec !== null || pxMs !== null) return syntaxError()
      const v = intValue(opts[i + 1])
      if (v === null) return invalidInt(opts[i + 1])
      if (v <= 0) return invalidExpire()
      exSec = v
      i++
    } else if (o === 'PX') {
      if (pxMs !== null || exSec !== null) return syntaxError()
      const v = intValue(opts[i + 1])
      if (v === null) return invalidInt(opts[i + 1])
      if (v <= 0) return invalidExpire()
      pxMs = v
      i++
    } else {
      return syntaxError()
    }
  }

  const exists = engine._get(key) !== null
  if (nxFlag && exists) return nilReply()
  if (xxFlag && !exists) return nilReply()

  const { entry, wrongType: wt } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()
  entry.value = String(value)
  engine._clearTtl(entry)
  if (exSec !== null) entry.expiresAt = engine.now() + exSec * 1000
  else if (pxMs !== null) entry.expiresAt = engine.now() + pxMs
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const GET = cmd({
  arity: 2,
  syntax: 'GET key',
  summary: 'Get the string value of a key.',
  group: 'strings',
  examples: ['GET name'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return nilReply()
  if (entry.type !== 'string') return wrongType()
  engine._touch(args[1], entry)
  return bulkReply(entry.value)
})

export const SETEX = cmd({
  arity: 4,
  syntax: 'SETEX key seconds value',
  summary: 'Set the value and expiration in seconds of a key.',
  group: 'strings',
  examples: ['SETEX session 3600 abc123'],
})((engine, args) => {
  const [, key, seconds, value] = args
  const sec = intValue(seconds)
  if (sec === null) return invalidInt(seconds)
  if (sec <= 0) return errorReply("ERR invalid expire time in 'setex' command")
  const { entry, wrongType: wt } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()
  entry.value = String(value)
  entry.expiresAt = engine.now() + sec * 1000
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const PSETEX = cmd({
  arity: 4,
  syntax: 'PSETEX key milliseconds value',
  summary: 'Set the value and expiration in milliseconds of a key.',
  group: 'strings',
  examples: ['PSETEX session 3600000 abc123'],
})((engine, args) => {
  const [, key, ms, value] = args
  const m = intValue(ms)
  if (m === null) return invalidInt(ms)
  if (m <= 0) return errorReply("ERR invalid expire time in 'psetex' command")
  const { entry, wrongType: wt } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()
  entry.value = String(value)
  entry.expiresAt = engine.now() + m
  engine._bump(key, entry)
  engine.emit('change')
  return okReply()
})

export const APPEND = cmd({
  arity: 3,
  syntax: 'APPEND key value',
  summary: 'Append a value to a key; returns the new length.',
  group: 'strings',
  examples: ['APPEND log "line 2\\n"'],
})((engine, args) => {
  const [, key, value] = args
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()
  entry.value = created ? String(value) : entry.value + String(value)
  engine._clearTtl(entry) // append replaces the value wholesale
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(entry.value.length)
})

export const STRLEN = cmd({
  arity: 2,
  syntax: 'STRLEN key',
  summary: 'Get the length of the value stored in a key.',
  group: 'strings',
  examples: ['STRLEN name'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'string') return wrongType()
  return integerReply(entry.value.length)
})

export const INCR = cmd({
  arity: 2,
  syntax: 'INCR key',
  summary: 'Increment the integer value of a key by one.',
  group: 'strings',
  examples: ['INCR visits'],
})((engine, args) => incrBy(engine, args[1], 1))

export const DECR = cmd({
  arity: 2,
  syntax: 'DECR key',
  summary: 'Decrement the integer value of a key by one.',
  group: 'strings',
  examples: ['DECR lives'],
})((engine, args) => incrBy(engine, args[1], -1))

export const INCRBY = cmd({
  arity: 3,
  syntax: 'INCRBY key increment',
  summary: 'Increment the integer value of a key by the given amount.',
  group: 'strings',
  examples: ['INCRBY score 10'],
})((engine, args) => incrBy(engine, args[1], parseDelta(args[2])))

export const DECRBY = cmd({
  arity: 3,
  syntax: 'DECRBY key decrement',
  summary: 'Decrement the integer value of a key by the given amount.',
  group: 'strings',
  examples: ['DECRBY score 10'],
})((engine, args) => incrBy(engine, args[1], -parseDelta(args[2])))

function parseDelta(arg) {
  const n = Number(arg)
  return Number.isSafeInteger(n) ? n : null
}

function incrBy(engine, key, delta) {
  if (delta === null) return invalidInt('n/a')
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()
  let base = 0
  if (!created) {
    if (!/^-?\d+$/.test(entry.value)) return invalidInt(entry.value)
    base = Number(entry.value)
  }
  const result = base + delta
  if (!Number.isSafeInteger(result)) return invalidInt('n/a')
  entry.value = String(result)
  engine._clearTtl(entry)
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(result)
}

export const GETSET = cmd({
  arity: 3,
  syntax: 'GETSET key value',
  summary: 'Set the string value of a key and return its old value.',
  group: 'strings',
  examples: ['GETSET counter 100'],
})((engine, args) => {
  const [, key, value] = args
  const existing = engine._get(key)
  if (existing && existing.type !== 'string') return wrongType()
  const { entry } = engine._entryForWrite(key, 'string')
  const old = entry.value
  entry.value = String(value)
  engine._clearTtl(entry)
  engine._bump(key, entry)
  engine.emit('change')
  return existing ? bulkReply(old) : nilReply()
})

export const MGET = cmd({
  arity: -2,
  syntax: 'MGET key [key ...]',
  summary: 'Get the values of all the given keys (non-strings -> nil).',
  group: 'strings',
  examples: ['MGET name age'],
})((engine, args) => {
  const out = []
  for (const key of args.slice(1)) {
    const entry = engine._get(key)
    if (!entry || entry.type !== 'string') out.push(nilReply())
    else out.push(bulkReply(entry.value))
  }
  return arrayReply(out)
})

export const MSET = cmd({
  arity: -3,
  syntax: 'MSET key value [key value ...]',
  summary: 'Set multiple keys to multiple values atomically.',
  group: 'strings',
  examples: ['MSET a 1 b 2 c 3'],
})((engine, args) => {
  const pairs = args.slice(1)
  if (pairs.length % 2 !== 0) {
    return errorReply("ERR wrong number of arguments for 'mset' command")
  }
  for (let i = 0; i < pairs.length; i += 2) {
    const key = pairs[i]
    const { entry, wrongType: wt } = engine._entryForWrite(key, 'string')
    if (wt) return wrongType()
    entry.value = String(pairs[i + 1])
    engine._clearTtl(entry)
    engine._bump(key, entry)
  }
  engine.emit('change')
  return okReply()
})

// keep named export unused-silent for the strings group

export const GETRANGE = cmd({
  arity: 4,
  syntax: 'GETRANGE key start end',
  summary: 'Get a substring of the string stored at a key (inclusive range, negative from end).',
  group: 'strings',
  examples: ['GETRANGE name 0 3'],
})((engine, args) => {
  const [, key, startStr, endStr] = args
  const start = intValue(startStr)
  const end = intValue(endStr)
  if (start === null || end === null) return invalidInt(start === null ? startStr : endStr)

  const entry = engine._get(key)
  if (!entry) return bulkReply('')
  if (entry.type !== 'string') return wrongType()

  const str = entry.value
  let startIdx = start
  let endIdx = end
  if (startIdx < 0) startIdx = str.length + startIdx
  if (endIdx < 0) endIdx = str.length + endIdx
  if (startIdx < 0) startIdx = 0
  if (endIdx >= str.length) endIdx = str.length - 1
  if (startIdx > endIdx || startIdx >= str.length) return bulkReply('')

  return bulkReply(str.slice(startIdx, endIdx + 1))
})

export const SETRANGE = cmd({
  arity: 4,
  syntax: 'SETRANGE key offset value',
  summary: 'Overwrite part of a string at key starting at the specified offset.',
  group: 'strings',
  examples: ['SETRANGE message 0 "Hello"'],
})((engine, args) => {
  const [, key, offsetStr, value] = args
  const offset = intValue(offsetStr)
  if (offset === null) return invalidInt(offsetStr)
  if (offset < 0) return errorReply('ERR value is out of range, must be positive')

  const { entry, wrongType: wt } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()

  let str = entry.value || ''
  const valStr = String(value)

  // Pad with null bytes if offset is beyond current length
  if (offset > str.length) {
    str += '\x00'.repeat(offset - str.length)
  }

  const before = str.slice(0, offset)
  const after = str.slice(offset + valStr.length)
  entry.value = before + valStr + after
  engine._clearTtl(entry)
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(entry.value.length)
})

export const INCRBYFLOAT = cmd({
  arity: 3,
  syntax: 'INCRBYFLOAT key increment',
  summary: 'Increment the float value of a key by the given amount.',
  group: 'strings',
  examples: ['INCRBYFLOAT score 0.5'],
})((engine, args) => {
  const [, key, increment] = args
  const inc = parseFloatArg(increment)
  if (inc === null) return invalidFloat(increment)

  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'string')
  if (wt) return wrongType()

  let base = 0
  if (!created) {
    const parsed = parseFloatArg(entry.value)
    if (parsed === null) return errorReply('ERR value is not a valid float')
    base = parsed
  }

  const result = base + inc
  if (!Number.isFinite(result)) {
    return errorReply('ERR increment would produce NaN or Infinity')
  }

  const formatted = formatFloat(result)
  entry.value = formatted
  engine._clearTtl(entry)
  engine._bump(key, entry)
  engine.emit('change')
  return bulkReply(formatted)
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
