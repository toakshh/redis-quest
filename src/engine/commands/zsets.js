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

// ---- ZREVRANGEBYSCORE helper ---------------------------------------------

function parseZRevRangeByScoreOpts(opts) {
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

// ---- ZUNIONSTORE / ZINTERSTORE helpers -----------------------------------

function parseWeights(opts) {
  const weights = []
  for (let i = 0; i < opts.length; i++) {
    const w = Number(opts[i])
    if (!Number.isFinite(w)) return { error: invalidFloat(opts[i]) }
    weights.push(w)
  }
  return weights
}

function parseAggregate(opt) {
  const v = String(opt).toUpperCase()
  if (v === 'SUM' || v === 'MIN' || v === 'MAX') return v
  return null
}

function getSortedSets(engine, keys) {
  const sets = []
  for (const key of keys) {
    const entry = engine._get(key)
    if (!entry) {
      sets.push(null)
    } else if (entry.type !== 'zset') {
      return { error: wrongType() }
    } else {
      sets.push(entry.value)
    }
  }
  return { sets }
}

function aggregateScores(existingScore, newScore, aggregate) {
  switch (aggregate) {
    case 'MIN':
      return Math.min(existingScore, newScore)
    case 'MAX':
      return Math.max(existingScore, newScore)
    case 'SUM':
    default:
      return existingScore + newScore
  }
}

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

export const ZREVRANGEBYSCORE = cmd({
  arity: -4,
  syntax: 'ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]',
  summary: 'Return members of a sorted set by score range, high to low.',
  group: 'zsets',
  examples: ['ZREVRANGEBYSCORE leaderboard +inf (5', 'ZREVRANGEBYSCORE leaderboard 10 -inf WITHSCORES LIMIT 0 5'],
})((engine, args) => {
  const [, key, maxArg, minArg, ...opts] = args
  const parsed = parseZRevRangeByScoreOpts(opts)
  if (parsed.error) return parsed.error
  const entry = engine._get(key)
  if (!entry) return emptyArrayReply()
  if (entry.type !== 'zset') return wrongType()
  // Note: ZREVRANGEBYSCORE takes max first, then min
  const maxB = parseBound(maxArg)
  const minB = parseBound(minArg)
  if (minB === null || maxB === null) return errorReply('ERR min or max is not a float')
  let nodes = rangeByScoreNodes(entry.value, minB, maxB, true)
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

export const ZUNIONSTORE = cmd({
  arity: -4,
  syntax: 'ZUNIONSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]',
  summary: 'Add multiple sorted sets and store result in destination.',
  group: 'zsets',
  examples: ['ZUNIONSTORE out 2 z1 z2', 'ZUNIONSTORE out 2 z1 z2 WEIGHTS 2 3 AGGREGATE MAX'],
})((engine, args) => {
  const [, dest, numKeysArg, ...rest] = args
  const numKeys = intValue(numKeysArg)
  if (numKeys === null || numKeys < 0) return invalidInt(numKeysArg)
  if (rest.length < numKeys) return syntaxError()
  const keys = rest.slice(0, numKeys)
  const opts = rest.slice(numKeys)

  let weights = null
  let aggregate = 'SUM'
  for (let i = 0; i < opts.length; i++) {
    const o = String(opts[i]).toUpperCase()
    if (o === 'WEIGHTS') {
      const weightArgs = opts.slice(i + 1, i + 1 + numKeys)
      if (weightArgs.length !== numKeys) return syntaxError()
      const parsedWeights = parseWeights(weightArgs)
      if (parsedWeights.error) return parsedWeights.error
      weights = parsedWeights
      i += numKeys
    } else if (o === 'AGGREGATE') {
      if (i + 1 >= opts.length) return syntaxError()
      const agg = parseAggregate(opts[i + 1])
      if (agg === null) return syntaxError()
      aggregate = agg
      i++
    } else {
      return syntaxError()
    }
  }
  if (weights === null) weights = new Array(numKeys).fill(1)

  const { sets, error } = getSortedSets(engine, keys)
  if (error) return error

  const { entry, wrongType: wt, created } = engine._entryForWrite(dest, 'zset')
  if (wt) return wrongType()
  if (created) entry.value = new SkipList()
  const destSkiplist = entry.value

  for (let i = 0; i < numKeys; i++) {
    const skiplist = sets[i]
    if (!skiplist) continue
    const weight = weights[i]
    for (const node of skiplist.toArray()) {
      const newScore = node.score * weight
      const cur = destSkiplist.scoreOf(node.member)
      if (cur !== null) {
        destSkiplist.remove(node.member)
        destSkiplist.insert(node.member, aggregateScores(cur, newScore, aggregate))
      } else {
        destSkiplist.insert(node.member, newScore)
      }
    }
  }

  if (destSkiplist.length === 0) {
    engine._delete(dest)
  } else {
    engine._bump(dest, entry)
    engine.emit('change')
  }
  return integerReply(destSkiplist.length)
})

export const ZINTERSTORE = cmd({
  arity: -4,
  syntax: 'ZINTERSTORE destination numkeys key [key ...] [WEIGHTS weight [weight ...]] [AGGREGATE SUM|MIN|MAX]',
  summary: 'Intersect multiple sorted sets and store result in destination.',
  group: 'zsets',
  examples: ['ZINTERSTORE out 2 z1 z2', 'ZINTERSTORE out 2 z1 z2 WEIGHTS 2 3 AGGREGATE MIN'],
})((engine, args) => {
  const [, dest, numKeysArg, ...rest] = args
  const numKeys = intValue(numKeysArg)
  if (numKeys === null || numKeys < 0) return invalidInt(numKeysArg)
  if (rest.length < numKeys) return syntaxError()
  const keys = rest.slice(0, numKeys)
  const opts = rest.slice(numKeys)

  let weights = null
  let aggregate = 'SUM'
  for (let i = 0; i < opts.length; i++) {
    const o = String(opts[i]).toUpperCase()
    if (o === 'WEIGHTS') {
      const weightArgs = opts.slice(i + 1, i + 1 + numKeys)
      if (weightArgs.length !== numKeys) return syntaxError()
      const parsedWeights = parseWeights(weightArgs)
      if (parsedWeights.error) return parsedWeights.error
      weights = parsedWeights
      i += numKeys
    } else if (o === 'AGGREGATE') {
      if (i + 1 >= opts.length) return syntaxError()
      const agg = parseAggregate(opts[i + 1])
      if (agg === null) return syntaxError()
      aggregate = agg
      i++
    } else {
      return syntaxError()
    }
  }
  if (weights === null) weights = new Array(numKeys).fill(1)

  const { sets, error } = getSortedSets(engine, keys)
  if (error) return error

  // Find intersection of all sets
  if (sets.length === 0 || sets.some(s => s === null)) {
    // If any key is missing, intersection is empty
    engine._delete(dest)
    return integerReply(0)
  }

  // Start with members from the first set
  const firstSet = sets[0]
  const memberScores = new Map()
  for (const node of firstSet.toArray()) {
    memberScores.set(node.member, node.score * weights[0])
  }

  // Intersect with remaining sets
  for (let i = 1; i < numKeys; i++) {
    const skiplist = sets[i]
    const weight = weights[i]
    const newMemberScores = new Map()
    for (const node of skiplist.toArray()) {
      const existingScore = memberScores.get(node.member)
      if (existingScore !== undefined) {
        newMemberScores.set(node.member, aggregateScores(existingScore, node.score * weight, aggregate))
      }
    }
    memberScores.clear()
    for (const [member, score] of newMemberScores) {
      memberScores.set(member, score)
    }
    if (memberScores.size === 0) break
  }

  const { entry, wrongType: wt, created } = engine._entryForWrite(dest, 'zset')
  if (wt) return wrongType()
  if (created) entry.value = new SkipList()
  const destSkiplist = entry.value

  for (const [member, score] of memberScores) {
    destSkiplist.insert(member, score)
  }

  if (destSkiplist.length === 0) {
    engine._delete(dest)
  } else {
    engine._bump(dest, entry)
    engine.emit('change')
  }
  return integerReply(destSkiplist.length)
})

export const ZPOPMIN = cmd({
  arity: -2,
  syntax: 'ZPOPMIN key [count]',
  summary: 'Remove and return members with the lowest scores.',
  group: 'zsets',
  examples: ['ZPOPMIN leaderboard', 'ZPOPMIN leaderboard 3'],
})((engine, args) => {
  const key = args[1]
  let count = 1
  if (args.length > 2) {
    count = intValue(args[2])
    if (count === null) return invalidInt(args[2])
    if (count < 0) return errorReply('ERR value is out of range, must be positive')
  }
  const entry = engine._get(key)
  if (!entry) return count > 1 ? emptyArrayReply() : nilReply()
  if (entry.type !== 'zset') return wrongType()
  const skiplist = entry.value
  if (skiplist.length === 0) return count > 1 ? emptyArrayReply() : nilReply()

  const nodes = skiplist.toArray()
  const toRemove = nodes.slice(0, Math.min(count, nodes.length))
  const out = []
  for (const node of toRemove) {
    skiplist.remove(node.member)
    out.push(bulkReply(node.member))
    out.push(bulkReply(formatScore(node.score)))
  }
  if (toRemove.length > 0) {
    if (skiplist.length === 0) engine._delete(key)
    else engine._bump(key, entry)
    engine.emit('change')
  }
  return arrayReply(out)
})

export const BZPOPMIN = cmd({
  arity: -3,
  syntax: 'BZPOPMIN key [key ...] timeout',
  summary: 'Blocking pop of members with lowest scores from sorted sets.',
  group: 'zsets',
  examples: ['BZPOPMIN z1 z2 5'],
})((engine, args) => {
  const keys = args.slice(1, -1)
  const timeoutArg = args[args.length - 1]
  const timeout = intValue(timeoutArg)
  if (timeout === null) return invalidInt(timeoutArg)
  if (timeout < 0) return errorReply('ERR timeout is out of range')
  if (keys.length === 0) return syntaxError()

  // In our mock engine, we just do a non-blocking check since we don't
  // implement actual blocking. This mimics the behavior when no elements exist.
  for (const key of keys) {
    const entry = engine._get(key)
    if (entry && entry.type === 'zset' && entry.value.length > 0) {
      const skiplist = entry.value
      const node = skiplist.toArray()[0]
      skiplist.remove(node.member)
      const out = [bulkReply(key), bulkReply(node.member), bulkReply(formatScore(node.score))]
      if (skiplist.length === 0) engine._delete(key)
      else engine._bump(key, entry)
      engine.emit('change')
      return arrayReply(out)
    } else if (entry && entry.type !== 'zset') {
      return wrongType()
    }
  }
  return nilReply()
})

export const BZPOPMAX = cmd({
  arity: -3,
  syntax: 'BZPOPMAX key [key ...] timeout',
  summary: 'Blocking pop of members with highest scores from sorted sets.',
  group: 'zsets',
  examples: ['BZPOPMAX z1 z2 5'],
})((engine, args) => {
  const keys = args.slice(1, -1)
  const timeoutArg = args[args.length - 1]
  const timeout = intValue(timeoutArg)
  if (timeout === null) return invalidInt(timeoutArg)
  if (timeout < 0) return errorReply('ERR timeout is out of range')
  if (keys.length === 0) return syntaxError()

  // In our mock engine, we just do a non-blocking check since we don't
  // implement actual blocking. This mimics the behavior when no elements exist.
  for (const key of keys) {
    const entry = engine._get(key)
    if (entry && entry.type === 'zset' && entry.value.length > 0) {
      const skiplist = entry.value
      const nodes = skiplist.toArray()
      const node = nodes[nodes.length - 1]
      skiplist.remove(node.member)
      const out = [bulkReply(key), bulkReply(node.member), bulkReply(formatScore(node.score))]
      if (skiplist.length === 0) engine._delete(key)
      else engine._bump(key, entry)
      engine.emit('change')
      return arrayReply(out)
    } else if (entry && entry.type !== 'zset') return wrongType()
  }
  return nilReply()
})
