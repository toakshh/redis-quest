import { cmd } from '../registry.js'
import { okReply, nilReply, arrayReply, errorReply } from '../reply.js'

// Transaction support. The engine owns the queue (multiQueue / multiError)
// and the queueing hook in _executeTokens; these handlers only flip the
// state machine and replay the queue on EXEC.

// Current "watch version" of a key: its mutation version, or 0 when the key
// is missing (the not-yet-created state). _bump / _delete drive these.
function watchVersion(engine, key) {
  const entry = engine._get(key)
  return entry ? entry.version : 0
}

// True when any watched key changed since it was recorded.
function watchedDirty(engine) {
  for (const [key, version] of engine.watchedKeys) {
    if (watchVersion(engine, key) !== version) return true
  }
  return false
}

export const MULTI = cmd({
  arity: 1,
  syntax: 'MULTI',
  summary: 'Start a transaction block, queueing subsequent commands until EXEC or DISCARD.',
  group: 'transactions',
  examples: ['MULTI', 'SET a 1', 'EXEC'],
})((engine) => {
  if (engine.multiQueue) return errorReply('ERR MULTI calls can not be nested')
  engine.multiQueue = []
  engine.multiError = false
  return okReply()
})

export const EXEC = cmd({
  arity: 1,
  syntax: 'EXEC',
  summary: 'Execute all commands queued by MULTI. Aborts if a WATCHed key changed.',
  group: 'transactions',
  examples: ['MULTI', 'SET a 1', 'EXEC'],
})((engine) => {
  if (!engine.multiQueue) return errorReply('ERR EXEC without MULTI')

  const queue = engine.multiQueue
  engine.multiQueue = null

  // A queued arity error poisons the whole batch, mirroring real Redis.
  if (engine.multiError) {
    engine.multiError = false
    engine.watchedKeys.clear()
    return errorReply('EXECABORT Transaction discarded because of previous errors.')
  }

  // Any WATCHed key that changed invalidates the transaction.
  if (watchedDirty(engine)) {
    engine.watchedKeys.clear()
    return nilReply()
  }
  engine.watchedKeys.clear()

  engine.stats.multiBatches++
  engine.multiExecuting = true
  const replies = []
  try {
    for (const tokens of queue) replies.push(engine._executeTokens(tokens))
  } finally {
    engine.multiExecuting = false
  }
  return arrayReply(replies)
})

export const DISCARD = cmd({
  arity: 1,
  syntax: 'DISCARD',
  summary: 'Discard all commands queued by MULTI and forget all watched keys.',
  group: 'transactions',
  examples: ['MULTI', 'SET a 1', 'DISCARD'],
})((engine) => {
  if (!engine.multiQueue) return errorReply('ERR DISCARD without MULTI')
  engine.multiQueue = null
  engine.multiError = false
  engine.watchedKeys.clear()
  return okReply()
})

export const WATCH = cmd({
  arity: -2,
  syntax: 'WATCH key [key ...]',
  summary: 'Watch keys for changes so a later EXEC aborts if any were modified.',
  group: 'transactions',
  examples: ['WATCH balance', 'MULTI', 'INCR balance', 'EXEC'],
})((engine, args) => {
  if (engine.multiQueue) return errorReply('ERR WATCH inside MULTI is not allowed')
  for (const key of args.slice(1)) {
    engine.watchedKeys.set(key, watchVersion(engine, key))
  }
  return okReply()
})

export const UNWATCH = cmd({
  arity: 1,
  syntax: 'UNWATCH',
  summary: 'Forget all keys watched by WATCH.',
  group: 'transactions',
  examples: ['WATCH balance', 'UNWATCH'],
})((engine) => {
  engine.watchedKeys.clear()
  return okReply()
})
