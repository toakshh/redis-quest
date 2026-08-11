import { cmd } from '../registry.js'
import {
  integerReply,
  bulkReply,
  nilReply,
  arrayReply,
  emptyArrayReply,
  errorReply,
  wrongType,
  invalidInt,
  intValue,
} from '../reply.js'

export const SADD = cmd({
  arity: -3,
  syntax: 'SADD key member [member ...]',
  summary: 'Add one or more members to a set; returns how many were new.',
  group: 'sets',
  examples: ['SADD tags redis', 'SADD users alice bob'],
})((engine, args) => {
  const key = args[1]
  const { entry, wrongType: wt } = engine._entryForWrite(key, 'set')
  if (wt) return wrongType()
  if (entry.value === null) entry.value = new Set()
  let added = 0
  for (const member of args.slice(2)) {
    if (!entry.value.has(member)) {
      entry.value.add(member)
      added++
    }
  }
  if (added > 0) {
    engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(added)
})

export const SREM = cmd({
  arity: -3,
  syntax: 'SREM key member [member ...]',
  summary: 'Remove one or more members from a set; returns how many were removed.',
  group: 'sets',
  examples: ['SREM tags redis'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'set') return wrongType()
  let removed = 0
  for (const member of args.slice(2)) {
    if (entry.value.delete(member)) removed++
  }
  if (removed === 0) return integerReply(0)
  if (entry.value.size === 0) engine._delete(key)
  else engine._bump(key, entry)
  engine.emit('change')
  return integerReply(removed)
})

export const SMEMBERS = cmd({
  arity: 2,
  syntax: 'SMEMBERS key',
  summary: 'Get all the members of a set (order is unspecified).',
  group: 'sets',
  examples: ['SMEMBERS tags'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'set') return wrongType()
  return arrayReply([...entry.value].map((m) => bulkReply(m)))
})

export const SISMEMBER = cmd({
  arity: 3,
  syntax: 'SISMEMBER key member',
  summary: 'Determine if a given value is a member of a set.',
  group: 'sets',
  examples: ['SISMEMBER tags redis'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'set') return wrongType()
  return integerReply(entry.value.has(args[2]) ? 1 : 0)
})

export const SCARD = cmd({
  arity: 2,
  syntax: 'SCARD key',
  summary: 'Get the number of members in a set.',
  group: 'sets',
  examples: ['SCARD tags'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'set') return wrongType()
  return integerReply(entry.value.size)
})

export const SPOP = cmd({
  arity: -2,
  syntax: 'SPOP key [count]',
  summary: 'Remove and return one or more random members from a set.',
  group: 'sets',
  examples: ['SPOP deck', 'SPOP deck 5'],
})((engine, args) => {
  const key = args[1]
  const hasCount = args.length > 2

  // Count is parsed and validated before the key lookup, matching real Redis.
  let count = null
  if (hasCount) {
    count = intValue(args[2])
    if (count === null) return invalidInt(args[2])
    if (count < 0) return errorReply('ERR value is out of range, must be positive')
  }

  const entry = engine._get(key)
  if (!entry) return hasCount ? emptyArrayReply() : nilReply()
  if (entry.type !== 'set') return wrongType()

  const set = entry.value
  if (set.size === 0) return hasCount ? emptyArrayReply() : nilReply()

  if (!hasCount) {
    const member = [...set][randomIndex(engine, set.size)]
    set.delete(member)
    if (set.size === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
    return bulkReply(member)
  }

  const members = [...set]
  const n = Math.min(count, members.length)
  const popped = []
  const start = randomIndex(engine, members.length)
  for (let i = 0; i < n; i++) {
    popped.push(members[(start + i) % members.length])
  }
  if (n > 0) {
    for (const member of popped) set.delete(member)
    if (set.size === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return arrayReply(popped.map((m) => bulkReply(m)))
})

export const SRANDMEMBER = cmd({
  arity: -2,
  syntax: 'SRANDMEMBER key [count]',
  summary: 'Get one or more random members from a set without removing them.',
  group: 'sets',
  examples: ['SRANDMEMBER tags', 'SRANDMEMBER tags 3'],
})((engine, args) => {
  const hasCount = args.length > 2

  // Count is parsed before the key lookup, matching real Redis.
  let count = null
  if (hasCount) {
    count = intValue(args[2])
    if (count === null) return invalidInt(args[2])
  }

  const entry = engine._get(args[1])
  if (!entry) return hasCount ? emptyArrayReply() : nilReply()
  if (entry.type !== 'set') return wrongType()

  const members = [...entry.value]
  if (members.length === 0) return hasCount ? emptyArrayReply() : nilReply()

  if (!hasCount) {
    return bulkReply(members[randomIndex(engine, members.length)])
  }

  const start = randomIndex(engine, members.length)
  const out = []
  const n = count >= 0 ? Math.min(count, members.length) : -count
  for (let i = 0; i < n; i++) {
    out.push(bulkReply(members[(start + i) % members.length]))
  }
  return arrayReply(out)
})

export const SMOVE = cmd({
  arity: 4,
  syntax: 'SMOVE source destination member',
  summary: 'Move a member from one set to another atomically.',
  group: 'sets',
  examples: ['SMOVE src dst alice'],
})((engine, args) => {
  const [, source, destination, member] = args
  const src = engine._get(source)
  if (!src) return integerReply(0)
  if (src.type !== 'set') return wrongType()
  if (!src.value.has(member)) return integerReply(0)

  // The member is removed from the source before the destination type check,
  // matching real Redis (a WRONGTYPE destination leaves the source mutated).
  src.value.delete(member)
  if (src.value.size === 0) engine._delete(source)
  else engine._bump(source, src)

  const dst = engine._get(destination)
  if (dst && dst.type !== 'set') {
    engine.emit('change')
    return wrongType()
  }

  let moved
  if (dst) {
    moved = !dst.value.has(member)
    dst.value.add(member)
    engine._bump(destination, dst)
  } else {
    const { entry } = engine._entryForWrite(destination, 'set')
    entry.value = new Set([member])
    engine._bump(destination, entry)
    moved = true
  }
  engine.emit('change')
  return integerReply(moved ? 1 : 0)
})

export const SUNION = cmd({
  arity: -2,
  syntax: 'SUNION key [key ...]',
  summary: 'Get the union of all the given sets.',
  group: 'sets',
  examples: ['SUNION a b c'],
})((engine, args) => {
  const { sets, wrongType: wt } = collectSets(engine, args.slice(1))
  if (wt) return wrongType()
  const union = new Set()
  for (const set of sets) {
    if (set) for (const member of set) union.add(member)
  }
  return arrayReply([...union].map((m) => bulkReply(m)))
})

export const SINTER = cmd({
  arity: -2,
  syntax: 'SINTER key [key ...]',
  summary: 'Get the intersection of all the given sets.',
  group: 'sets',
  examples: ['SINTER a b c'],
})((engine, args) => {
  const { sets, wrongType: wt } = collectSets(engine, args.slice(1))
  if (wt) return wrongType()
  if (sets.length === 0 || sets[0] === null) return emptyArrayReply()
  const out = []
  for (const member of sets[0]) {
    if (sets.slice(1).every((s) => s !== null && s.has(member))) {
      out.push(bulkReply(member))
    }
  }
  return arrayReply(out)
})

export const SDIFF = cmd({
  arity: -2,
  syntax: 'SDIFF key [key ...]',
  summary: 'Get the difference of the given sets (members in the first not in the others).',
  group: 'sets',
  examples: ['SDIFF a b c'],
})((engine, args) => {
  const { sets, wrongType: wt } = collectSets(engine, args.slice(1))
  if (wt) return wrongType()
  if (sets.length === 0 || sets[0] === null) return emptyArrayReply()
  const out = []
  for (const member of sets[0]) {
    if (!sets.slice(1).some((s) => s !== null && s.has(member))) {
      out.push(bulkReply(member))
    }
  }
  return arrayReply(out)
})

// Gather live set values for the given keys. Missing keys are kept as null so
// callers can treat them as empty sets while preserving the requested order
// (real Redis SUNION/SINTER/SDIFF all handle missing keys as empty sets).
function collectSets(engine, keys) {
  const sets = []
  for (const key of keys) {
    const entry = engine._get(key)
    if (!entry) {
      sets.push(null)
    } else if (entry.type !== 'set') {
      return { wrongType: true }
    } else {
      sets.push(entry.value)
    }
  }
  return { sets }
}

// Real Redis SPOP/SRANDMEMBER pick randomly; the mock selects deterministically
// so mission tests stay reproducible. Seeding from the command counter also
// makes consecutive calls return different members.
function randomIndex(engine, size) {
  if (size <= 1) return 0
  return engine.stats.totalCommands % size
}
