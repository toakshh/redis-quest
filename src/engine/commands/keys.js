import { cmd } from '../registry.js'
import {
  okReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  simpleReply,
  errorReply,
  noSuchKey,
  invalidInt,
  intValue,
} from '../reply.js'
import { makeGlobMatcher } from '../datatypes/glob.js'

export const DEL = cmd({
  arity: -2,
  syntax: 'DEL key [key ...]',
  summary: 'Delete one or more keys, returning how many were removed.',
  group: 'keys',
  examples: ['DEL session', 'DEL a b c'],
})((engine, args) => {
  let count = 0
  for (const key of args.slice(1)) {
    // _get lazily expires, so a live key here is one that will actually be removed.
    if (engine._get(key) !== null) {
      engine._delete(key)
      count++
    }
  }
  if (count > 0) engine.emit('change')
  return integerReply(count)
})

export const EXISTS = cmd({
  arity: -2,
  syntax: 'EXISTS key [key ...]',
  summary: 'Return how many of the given keys exist.',
  group: 'keys',
  examples: ['EXISTS name', 'EXISTS a b c'],
})((engine, args) => {
  let count = 0
  for (const key of args.slice(1)) {
    if (engine._get(key) !== null) count++
  }
  return integerReply(count)
})

export const TYPE = cmd({
  arity: 2,
  syntax: 'TYPE key',
  summary: 'Return the type of the value stored at key.',
  group: 'keys',
  examples: ['TYPE name'],
})((engine, args) => {
  const entry = engine._get(args[1])
  return simpleReply(entry ? entry.type : 'none')
})

export const EXPIRE = cmd({
  arity: 3,
  syntax: 'EXPIRE key seconds',
  summary: 'Set a timeout on key in seconds. Non-positive seconds delete the key.',
  group: 'keys',
  examples: ['EXPIRE session 3600'],
})((engine, args) => {
  const [, key, seconds] = args
  const sec = intValue(seconds)
  if (sec === null) return invalidInt(seconds)
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (sec <= 0) {
    engine._delete(key)
    engine.emit('change')
    return integerReply(1)
  }
  entry.expiresAt = engine.now() + sec * 1000
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(1)
})

export const PEXPIRE = cmd({
  arity: 3,
  syntax: 'PEXPIRE key milliseconds',
  summary: 'Set a timeout on key in milliseconds. Non-positive values delete the key.',
  group: 'keys',
  examples: ['PEXPIRE session 3600000'],
})((engine, args) => {
  const [, key, ms] = args
  const m = intValue(ms)
  if (m === null) return invalidInt(ms)
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (m <= 0) {
    engine._delete(key)
    engine.emit('change')
    return integerReply(1)
  }
  entry.expiresAt = engine.now() + m
  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(1)
})

export const TTL = cmd({
  arity: 2,
  syntax: 'TTL key',
  summary: 'Return the remaining time to live of a key in seconds, or -2/-1 if missing/persistent.',
  group: 'keys',
  examples: ['TTL session'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(-2)
  if (entry.expiresAt === null) return integerReply(-1)
  const ttl = entry.expiresAt - engine.now()
  return integerReply(Math.floor((ttl + 500) / 1000))
})

export const PTTL = cmd({
  arity: 2,
  syntax: 'PTTL key',
  summary: 'Return the remaining time to live of a key in milliseconds, or -2/-1 if missing/persistent.',
  group: 'keys',
  examples: ['PTTL session'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(-2)
  if (entry.expiresAt === null) return integerReply(-1)
  return integerReply(entry.expiresAt - engine.now())
})

export const PERSIST = cmd({
  arity: 2,
  syntax: 'PERSIST key',
  summary: 'Remove the expiration from a key, returning 1 if a timeout was removed.',
  group: 'keys',
  examples: ['PERSIST session'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry || entry.expiresAt === null) return integerReply(0)
  engine._clearTtl(entry)
  engine.emit('change')
  return integerReply(1)
})

export const KEYS = cmd({
  arity: 2,
  syntax: 'KEYS pattern',
  summary: 'Return all keys matching the given glob pattern.',
  group: 'keys',
  examples: ['KEYS *', 'KEYS user:*'],
})((engine, args) => {
  const matcher = makeGlobMatcher(args[1])
  const out = []
  for (const key of [...engine.store.keys()]) {
    // _get lazily drops expired keys so they never show up in the scan.
    if (engine._get(key) !== null && matcher(key)) out.push(bulkReply(key))
  }
  return arrayReply(out)
})

export const RENAME = cmd({
  arity: 3,
  syntax: 'RENAME key newkey',
  summary: 'Rename a key, overwriting the destination if it exists.',
  group: 'keys',
  examples: ['RENAME old new'],
})((engine, args) => {
  const [, key, newkey] = args
  if (key === newkey) return errorReply('ERR source and destination objects are the same')
  const entry = engine._get(key)
  if (!entry) return noSuchKey()
  engine.store.delete(key)
  engine.store.set(newkey, entry)
  engine._cache.dirty = true
  engine.emit('change')
  return okReply()
})

export const RENAMENX = cmd({
  arity: 3,
  syntax: 'RENAMENX key newkey',
  summary: 'Rename a key only when the destination does not exist.',
  group: 'keys',
  examples: ['RENAMENX old new'],
})((engine, args) => {
  const [, key, newkey] = args
  if (key === newkey) return errorReply('ERR source and destination objects are the same')
  const entry = engine._get(key)
  if (!entry) return noSuchKey()
  if (engine._get(newkey) !== null) return integerReply(0)
  engine.store.delete(key)
  engine.store.set(newkey, entry)
  engine._cache.dirty = true
  engine.emit('change')
  return integerReply(1)
})

export const RANDOMKEY = cmd({
  arity: 1,
  syntax: 'RANDOMKEY',
  summary: 'Return a random key from the current database, or nil if empty.',
  group: 'keys',
  examples: ['RANDOMKEY'],
})((engine) => {
  const keys = []
  for (const key of engine.store.keys()) {
    if (engine._get(key) !== null) keys.push(key)
  }
  if (keys.length === 0) return nilReply()
  return bulkReply(keys[Math.floor(engine.random() * keys.length)])
})

export const DBSIZE = cmd({
  arity: 1,
  syntax: 'DBSIZE',
  summary: 'Return the number of live keys in the current database.',
  group: 'keys',
  examples: ['DBSIZE'],
})((engine) => {
  let count = 0
  for (const key of [...engine.store.keys()]) {
    if (engine._get(key) !== null) count++
  }
  return integerReply(count)
})

export const FLUSHDB = cmd({
  arity: 1,
  syntax: 'FLUSHDB',
  summary: 'Remove all keys from the current database.',
  group: 'keys',
  examples: ['FLUSHDB'],
})((engine) => {
  if (engine.store.size === 0) return okReply()
  engine.store.clear()
  engine._cache.dirty = true
  engine.emit('change')
  return okReply()
})

export const FLUSHALL = cmd({
  arity: 1,
  syntax: 'FLUSHALL',
  summary: 'Remove all keys from every database.',
  group: 'keys',
  examples: ['FLUSHALL'],
})((engine) => {
  let total = 0
  for (const db of engine.databases.values()) total += db.size
  if (total === 0) return okReply()
  for (const db of engine.databases.values()) db.clear()
  engine._cache.dirty = true
  engine.emit('change')
  return okReply()
})
