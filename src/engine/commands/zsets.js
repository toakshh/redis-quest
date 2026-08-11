import { cmd } from '../registry.js'
import {
  integerReply,
  bulkReply,
  nilReply,
  arrayReply,
  emptyArrayReply,
  errorReply,
  wrongType,
  syntaxError,
  invalidInt,
  invalidFloat,
  intValue,
} from '../reply.js'
import { SkipList } from '../datatypes/SkipList.js'

// ---- score helpers -----------------------------------------------------

// Parse a Redis float score ("1.5", "1e3", "-inf", "+inf"). Returns the
// number or null when the arg is not a valid float (NaN/overflow rejected).
function parseScore(arg) {
  const s = String(arg).trim()
  const low = s.toLowerCase()
  if (low === 'inf' || low === '+inf' || low === 'infinity' || low === '+infinity') {
    return Infinity
  }
  if (low === '-inf' || low === '-infinity') return -Infinity
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Format a score the way Redis replies to ZSCORE / ZADD ... INCR: integers
// print without a decimal point, everything else at 17 significant digits.
function formatScore(score) {
  if (!Number.isFinite(score)) return score > 0 ? 'inf' : '-inf'
  if (Number.isInteger(score)) return String(score)
  return String(Number(score.toPrecision(17)))
}

// A score-range bound: "5", "5.5", "+inf", "(5" (exclusive). Returns
// { value, exclusive } or null when the bound is not a valid float.
function parseBound(arg) {
  const s = String(arg)
  if (s.startsWith('(')) {
    const v = parseScore(s.slice(1))
    return v === null ? null : { value: v, exclusive: true }
  }
  const v = parseScore(s)
  return v === null ? null : { value: v, exclusive: false }
}

// ---- zset mutation helpers ---------------------------------------------

// Apply one ZADD score-member update to the skiplist, honoring NX/XX/GT/LT.
function zsetAdd(skiplist, member, score, flags) {
  const cur = skiplist.scoreOf(member)
  if (cur !== null) {
    if (flags.nx) return { nop: true }
    if (flags.gt && score <= cur) return { nop: true }
    if (flags.lt && score >= cur) return { nop: true }
    if (score === cur) return { noChange: true }
    skiplist.remove(member)
    skiplist.insert(member, score)
    return { updated: true }
  }
  if (flags.xx) return { nop: true }
  skiplist.insert(member, score)
  return { added: true }
}

// ZINCRBY / ZADD ... INCR: add `increment` to the member's score. Returns
// the new score, null when NX/XX/GT/LT aborts the change, or NaN when the
// arithmetic spills into NaN (+inf + -inf).
function zsetIncr(skiplist, member, increment, flags) {
  const cur = skiplist.scoreOf(member)
  const next = cur === null ? increment : cur + increment
  if (Number.isNaN(next)) return NaN
  if (cur !== null) {
    if (flags.nx) return null
    if (flags.gt && next <= cur) return null
    if (flags.lt && next >= cur) return null
    if (next === cur) return next
    skiplist.remove(member)
  } else if (flags.xx) {
    return null
  }
  skiplist.insert(member, next)
  return next
}

// ---- range helpers -----------------------------------------------------

// Members in the rank window [start, stop], honoring negative indexes.
// reverse=true returns highest scores first (ZREVRANGE ordering).
function rangeNodes(skiplist, start, stop, reverse) {
  const nodes = reverse ? skiplist.toArray().reverse() : skiplist.toArray()
  const len = nodes.length
  if (len === 0) return []
  if (start < 0) start = len + start
  if (stop < 0) stop = len + stop
  if (start < 0) start = 0
  if (stop >= len) stop = len - 1
  if (start > stop) return []
  return nodes.slice(start, stop + 1)
}

// Nodes within the parsed score bounds, honoring exclusive markers.
function rangeByScoreNodes(skiplist, minB, maxB, reverse) {
  const out = []
  for (const item of skiplist.rangeByScore(minB.value, maxB.value, reverse)) {
    if (minB.exclusive && item.score === minB.value) continue
    if (maxB.exclusive && item.score === maxB.value) continue
    out.push(item)
  }
  return out
}

// Zero-based rank of member (rank 0 = smallest score), or null.
function memberRank(skiplist, member, reverse) {
  const nodes = skiplist.toArray()
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].member === member) return reverse ? nodes.length - 1 - i : i
  }
  return null
}

// [WITHSCORES] [LIMIT offset count] for ZRANGEBYSCORE. Returns parsed opts
// or { error } on the first offending token.
function parseRangeOpts(opts) {
  const parsed = { withScores: false, limit: null }
  for (let i = 0; i < opts.length; i++) {
    const o = String(opts[i]).toUpperCase()
    if (o === 'WITHSCORES') {
      if (parsed.withScores) return { error: syntaxError() }
      parsed.withScores = true
    } else if (o === 'LIMIT') {
      if (parsed.limit) return { error: syntaxError() }
      const offset = intValue(opts[i + 1])
      const count = intValue(opts[i + 2])
      if (offset === null) return { error: invalidInt(opts[i + 1]) }
      if (count === null) return { error: invalidInt(opts[i + 2]) }
      if (offset < 0) return { error: errorReply('ERR offset is out of range') }
      parsed.limit = { offset, count }
      i += 2
    } else {
      return { error: syntaxError() }
    }
  }
  return parsed
}

// ---- commands ----------------------------------------------------------

export const ZADD = cmd({
  arity: -4,
  syntax: 'ZADD key [NX|XX] [GT|LT] [CH] [INCR] score member [score member ...]',
  summary: 'Add one or more members to a sorted set, or update their scores.',
  group: 'zsets',
  examples: ['ZADD leaderboard 10 alice', 'ZADD scores NX CH 5 carl', 'ZADD totals INCR 2 alice'],
})((engine, args) => {
  const key = args[1]

  // Options come first; the first token that is not one of them starts the
  // score/member pairs.
  let nx = false
  let xx = false
  let ch = false
  let gt = false
  let lt = false
  let incr = false
  let i = 2
  for (; i < args.length; i++) {
    const o = args[i].toUpperCase()
    if (o === 'NX') nx = true
    else if (o === 'XX') xx = true
    else if (o === 'CH') ch = true
    else if (o === 'GT') gt = true
    else if (o === 'LT') lt = true
    else if (o === 'INCR') incr = true
    else break
  }

  const pairs = args.slice(i)
  if (pairs.length === 0 || pairs.length % 2 !== 0) return syntaxError()
  if (incr && pairs.length !== 2) {
    return errorReply('ERR INCR option supports a single increment-element pair')
  }
  if (incr && gt) return errorReply('ERR GT option not supported in combination with the INCR option')
  if (incr && lt) return errorReply('ERR LT option not supported in combination with the INCR option')
  if (nx && xx) return errorReply('ERR XX and NX options at the same time are not compatible')
  if (gt && nx) return errorReply('ERR GT option not supported in combination with the NX option')
  if (lt && nx) return errorReply('ERR LT option not supported in combination with the NX option')
  if (gt && lt) return errorReply('ERR GT, LT, and/or NX options at the same time are not compatible')

  const parsed = []
  for (let j = 0; j < pairs.length; j += 2) {
    const score = parseScore(pairs[j])
    if (score === null) return invalidFloat(pairs[j])
    parsed.push({ member: String(pairs[j + 1]), score })
  }

  // XX never creates a key, so bail early to avoid materializing an empty zset.
  const existing = engine._get(key)
  if (existing && existing.type !== 'zset') return wrongType()
  if (!existing && xx) return integerReply(0)

  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'zset')
  if (wt) return wrongType()
  if (created) entry.value = new SkipList()
  const skiplist = entry.value

  if (incr) {
    const next = zsetIncr(skiplist, parsed[0].member, parsed[0].score, { nx, xx, gt, lt })
    if (next === null) return nilReply()
    if (Number.isNaN(next)) return errorReply('ERR resulting score is not a number (NaN)')
    engine._bump(key, entry)
    engine.emit('change')
    return bulkReply(formatScore(next))
  }

  let added = 0
  let updated = 0
  for (const { member, score } of parsed) {
    const r = zsetAdd(skiplist, member, score, { nx, xx, gt, lt })
    if (r.added) added++
    if (r.updated) updated++
  }
  if (added + updated > 0) {
    engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(ch ? added + updated : added)
})

export const ZREM = cmd({
  arity: -3,
  syntax: 'ZREM key member [member ...]',
  summary: 'Remove one or more members from a sorted set; returns how many were removed.',
  group: 'zsets',
  examples: ['ZREM leaderboard alice', 'ZREM leaderboard bob carol'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'zset') return wrongType()
  const skiplist = entry.value
  let removed = 0
  for (const member of args.slice(2)) {
    if (skiplist.remove(String(member))) removed++
  }
  if (removed > 0) {
    if (skiplist.length === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(removed)
})

export const ZSCORE = cmd({
  arity: 3,
  syntax: 'ZSCORE key member',
  summary: 'Get the score of a member in a sorted set.',
  group: 'zsets',
  examples: ['ZSCORE leaderboard alice'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return nilReply()
  if (entry.type !== 'zset') return wrongType()
  const score = entry.value.scoreOf(String(args[2]))
  return score === null ? nilReply() : bulkReply(formatScore(score))
})

export const ZCARD = cmd({
  arity: 2,
  syntax: 'ZCARD key',
  summary: 'Get the number of members in a sorted set.',
  group: 'zsets',
  examples: ['ZCARD leaderboard'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'zset') return wrongType()
  return integerReply(entry.value.length)
})

export const ZCOUNT = cmd({
  arity: 4,
  syntax: 'ZCOUNT key min max',
  summary: 'Count members in a sorted set with scores within the given range.',
  group: 'zsets',
  examples: ['ZCOUNT leaderboard (5 +inf', 'ZCOUNT leaderboard -inf +inf'],
})((engine, args) => {
  const entry = engine._get(args[1])
  if (!entry) return integerReply(0)
  if (entry.type !== 'zset') return wrongType()
  const minB = parseBound(args[2])
  const maxB = parseBound(args[3])
  if (minB === null || maxB === null) return errorReply('ERR min or max is not a float')
  return integerReply(rangeByScoreNodes(entry.value, minB, maxB, false).length)
})

export const ZRANGE = cmd({
  arity: -4,
  syntax: 'ZRANGE key start stop [WITHSCORES]',
  summary: 'Return a range of members in a sorted set by index, low to high score.',
  group: 'zsets',
  examples: ['ZRANGE leaderboard 0 -1', 'ZRANGE leaderboard 0 2 WITHSCORES'],
})((engine, args) => zrangeByRank(engine, args, false))

export const ZREVRANGE = cmd({
  arity: -4,
  syntax: 'ZREVRANGE key start stop [WITHSCORES]',
  summary: 'Return a range of members in a sorted set by index, high to low score.',
  group: 'zsets',
  examples: ['ZREVRANGE leaderboard 0 -1', 'ZREVRANGE leaderboard 0 2 WITHSCORES'],
})((engine, args) => zrangeByRank(engine, args, true))

function zrangeByRank(engine, args, reverse) {
  const [, key, startArg, stopArg, ...opts] = args
  const withScores = opts.length > 0 && opts[0].toUpperCase() === 'WITHSCORES'
  if (opts.length > 1 || (opts.length === 1 && !withScores)) return syntaxError()
  const entry = engine._get(key)
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'zset') return wrongType()
  const start = intValue(startArg)
  const stop = intValue(stopArg)
  if (start === null) return invalidInt(startArg)
  if (stop === null) return invalidInt(stopArg)
  const out = []
  for (const node of rangeNodes(entry.value, start, stop, reverse)) {
    out.push(bulkReply(node.member))
    if (withScores) out.push(bulkReply(formatScore(node.score)))
  }
  return arrayReply(out)
}

export const ZRANGEBYSCORE = cmd({
  arity: -4,
  syntax: 'ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]',
  summary: 'Return members of a sorted set by score range, low to high.',
  group: 'zsets',
  examples: ['ZRANGEBYSCORE leaderboard (5 +inf', 'ZRANGEBYSCORE leaderboard -inf 10 WITHSCORES LIMIT 0 5'],
})((engine, args) => {
  const [, key, minArg, maxArg, ...opts] = args
  const parsed = parseRangeOpts(opts)
  if (parsed.error) return parsed.error
  const entry = engine._get(key)
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'zset') return wrongType()
  const minB = parseBound(minArg)
  const maxB = parseBound(maxArg)
  if (minB === null || maxB === null) return errorReply('ERR min or max is not a float')
  let nodes = rangeByScoreNodes(entry.value, minB, maxB, false)
  if (parsed.limit) {
    const { offset, count } = parsed.limit
    if (offset >= nodes.length) nodes = []
    else nodes = nodes.slice(offset, count < 0 ? undefined : offset + count)
  }
  const out = []
  for (const node of nodes) {
    out.push(bulkReply(node.member))
    if (parsed.withScores) out.push(bulkReply(formatScore(node.score)))
  }
  return arrayReply(out)
})

export const ZRANK = cmd({
  arity: 3,
  syntax: 'ZRANK key member',
  summary: 'Determine the index of a member in a sorted set, low to high score.',
  group: 'zsets',
  examples: ['ZRANK leaderboard alice'],
})((engine, args) => zrankGeneric(engine, args, false))

export const ZREVRANK = cmd({
  arity: 3,
  syntax: 'ZREVRANK key member',
  summary: 'Determine the index of a member in a sorted set, high to low score.',
  group: 'zsets',
  examples: ['ZREVRANK leaderboard alice'],
})((engine, args) => zrankGeneric(engine, args, true))

function zrankGeneric(engine, args, reverse) {
  const entry = engine._get(args[1])
  if (!entry) return nilReply()
  if (entry.type !== 'zset') return wrongType()
  const rank = memberRank(entry.value, String(args[2]), reverse)
  return rank === null ? nilReply() : integerReply(rank)
}

export const ZINCRBY = cmd({
  arity: 4,
  syntax: 'ZINCRBY key increment member',
  summary: 'Increment the score of a member in a sorted set.',
  group: 'zsets',
  examples: ['ZINCRBY leaderboard 5 alice'],
})((engine, args) => {
  const [, key, incrArg, member] = args
  const incr = parseScore(incrArg)
  if (incr === null) return invalidFloat(incrArg)
  const { entry, wrongType: wt, created } = engine._entryForWrite(key, 'zset')
  if (wt) return wrongType()
  if (created) entry.value = new SkipList()
  const next = zsetIncr(entry.value, String(member), incr, {})
  if (Number.isNaN(next)) return errorReply('ERR resulting score is not a number (NaN)')
  engine._bump(key, entry)
  engine.emit('change')
  return bulkReply(formatScore(next))
})

export const ZREMRANGEBYRANK = cmd({
  arity: 4,
  syntax: 'ZREMRANGEBYRANK key start stop',
  summary: 'Remove all members in a sorted set within the given ranks.',
  group: 'zsets',
  examples: ['ZREMRANGEBYRANK leaderboard 0 1'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'zset') return wrongType()
  const start = intValue(args[2])
  const stop = intValue(args[3])
  if (start === null) return invalidInt(args[2])
  if (stop === null) return invalidInt(args[3])
  const skiplist = entry.value
  const nodes = rangeNodes(skiplist, start, stop, false)
  for (const node of nodes) skiplist.remove(node.member)
  if (nodes.length > 0) {
    if (skiplist.length === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(nodes.length)
})

export const ZREMRANGEBYSCORE = cmd({
  arity: 4,
  syntax: 'ZREMRANGEBYSCORE key min max',
  summary: 'Remove all members in a sorted set within the given scores.',
  group: 'zsets',
  examples: ['ZREMRANGEBYSCORE leaderboard -inf (10'],
})((engine, args) => {
  const key = args[1]
  const entry = engine._get(key)
  if (!entry) return integerReply(0)
  if (entry.type !== 'zset') return wrongType()
  const minB = parseBound(args[2])
  const maxB = parseBound(args[3])
  if (minB === null || maxB === null) return errorReply('ERR min or max is not a float')
  const skiplist = entry.value
  const nodes = rangeByScoreNodes(skiplist, minB, maxB, false)
  for (const node of nodes) skiplist.remove(node.member)
  if (nodes.length > 0) {
    if (skiplist.length === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return integerReply(nodes.length)
})
