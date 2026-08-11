import { splitArgs } from './parser.js'
import { registry } from './registry.js'
import { unknownCommand, errorReply, simpleReply, wrongArity } from './reply.js'
import { totalMemoryBytes, MEMORY_CONSTANTS } from './datatypes/memory.js'

// A tiny emitter so the app (terminal, inspector, mission engine) can react
// to engine mutations without coupling.
class Emitter {
  constructor() {
    this.handlers = new Map()
  }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event).add(fn)
    return () => this.off(event, fn)
  }
  off(event, fn) {
    this.handlers.get(event)?.delete(fn)
  }
  emit(event, payload) {
    const set = this.handlers.get(event)
    if (set) for (const fn of set) fn(payload)
  }
}

const DB_COUNT = 16
const SWEEP_INTERVAL_MS = 1000

export class MockRedisEngine {
  constructor({ memoryLimit = MEMORY_CONSTANTS.DEFAULT_MEMORY_LIMIT, now = null } = {}) {
    this.databases = new Map()
    for (let i = 0; i < DB_COUNT; i++) this.databases.set(i, new Map())
    this.activeDb = 0
    this.memoryLimit = memoryLimit
    this._now = now // injectable clock for tests (null = real Date.now)
    this.emitter = new Emitter()

    this.stats = {
      totalCommands: 0,
      totalErrors: 0,
      keysCreated: 0,
      keysExpired: 0,
      memoryPeak: 0,
      multiBatches: 0,
      scriptsRun: 0,
      commandsByType: {},
      // EMA of commands per second, recomputed on each execute
      opsPerSecond: 0,
      commandsPerMinute: 0,
      startedAt: this.now(),
      _lastCommandTime: this.now(),
    }

    // pub/sub bus (per-db channels share one bus in our mock)
    this.subscribers = new Map() // channel -> Set of connection ids
    this.connectionId = 'local-terminal'

    // transaction state
    this.multiQueue = null
    this.multiError = false
    this.watchedKeys = new Map() // key -> version

    this._sweepTimer = null
    this._lastSweep = this.now()
    this._cache = { memoryBytes: 0, dirty: true }

    this.commandRegistry = registry
  }

  now() {
    return this._now !== null ? this._now() : Date.now()
  }

  // ---- store access ----------------------------------------------------

  get store() {
    return this.databases.get(this.activeDb)
  }

  // Live entry for a key, applying lazy expiry. Returns null if missing/expired.
  _get(key) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key)
      this.stats.keysExpired++
      this._cache.dirty = true
      this.emit('expired', key)
      this.emit('change')
      return null
    }
    return entry
  }

  // Create or fetch an entry, ready for mutation. If it exists it must be
  // the requested type or we return { wrongType: true }. Does NOT touch
  // expiresAt — commands that replace a whole value (SET, GETSET, APPEND...)
  // clear TTL explicitly via _clearTtl, while element ops (HSET, LPUSH...)
  // must preserve the existing TTL, matching real Redis.
  _entryForWrite(key, type) {
    const existing = this._get(key)
    if (existing) {
      if (existing.type !== type) return { wrongType: true }
      return { entry: existing }
    }
    const entry = { type, value: null, expiresAt: null, version: 0, lruTick: 0 }
    this.store.set(key, entry)
    this.stats.keysCreated++
    this._cache.dirty = true
    return { entry, created: true }
  }

  // Whole-value writes clear any TTL (matches real Redis).
  _clearTtl(entry) {
    if (entry.expiresAt !== null) {
      entry.expiresAt = null
      this._cache.dirty = true
    }
  }

  _touch(key, entry) {
    entry.lruTick = this.stats.totalCommands
  }

  _bump(key, entry) {
    entry.version++
    entry.lruTick = this.stats.totalCommands
    this._cache.dirty = true
  }

  _delete(key) {
    if (this.store.delete(key)) {
      this._cache.dirty = true
      return true
    }
    return false
  }

  // ---- expiry ----------------------------------------------------------

  // Remove all expired keys now. Called on a timer and lazily.
  _sweepExpired() {
    const now = this.now()
    let removed = 0
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.store.delete(key)
        removed++
      }
    }
    if (removed > 0) {
      this.stats.keysExpired += removed
      this._cache.dirty = true
      this.emit('expired')
      this.emit('change')
    }
    this._lastSweep = now
  }

  startSweeping() {
    if (this._sweepTimer) return
    this._sweepTimer = setInterval(() => this._sweepExpired(), SWEEP_INTERVAL_MS)
  }

  stopSweeping() {
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer)
      this._sweepTimer = null
    }
  }

  // ---- stats -----------------------------------------------------------

  get memoryBytes() {
    if (this._cache.dirty) {
      let total = 0
      for (const db of this.databases.values()) total += totalMemoryBytes(db)
      this._cache.memoryBytes = total
      this._cache.dirty = false
      if (total > this.stats.memoryPeak) this.stats.memoryPeak = total
    }
    return this._cache.memoryBytes
  }

  get memoryLimit() {
    return this._limit
  }

  set memoryLimit(v) {
    this._limit = v
  }

  _recordCommand(canonicalName) {
    const now = this.now()
    const dt = Math.max(now - this.stats._lastCommandTime, 1)
    this.stats._lastCommandTime = now
    const instant = 1000 / dt
    // EMA with alpha ~0.2
    this.stats.opsPerSecond = this.stats.opsPerSecond * 0.8 + instant * 0.2
    this.stats.commandsPerMinute = this.stats.opsPerSecond * 60
    this.stats.totalCommands++
    this.stats.commandsByType[canonicalName] = (this.stats.commandsByType[canonicalName] || 0) + 1
  }

  // ---- pub/sub ---------------------------------------------------------

  subscribeChannel(channel) {
    if (!this.subscribers.has(channel)) this.subscribers.set(channel, new Set())
    this.subscribers.get(channel).add(this.connectionId)
    return this.subscribers.get(channel).size
  }

  unsubscribeChannel(channel) {
    const set = this.subscribers.get(channel)
    if (!set) return 0
    set.delete(this.connectionId)
    if (set.size === 0) this.subscribers.delete(channel)
    return set.size
  }

  publishMessage(channel, message) {
    const set = this.subscribers.get(channel)
    const count = set ? set.size : 0
    if (count > 0) {
      this.emit('message', { channel, message, count })
    }
    return count
  }

  // ---- command dispatch ------------------------------------------------

  // Parse + execute a full command line (redis-cli style input).
  execute(line) {
    const { ok, tokens, error } = splitArgs(line)
    if (!ok) {
      this.stats.totalErrors++
      this.emit('error')
      return errorReply(error)
    }
    if (tokens.length === 0) {
      return simpleReply('') // empty line -> nothing (redis-cli prints nothing)
    }
    return this._executeTokens(tokens)
  }

  // Programmatic execution for mission validators / tests / boss waves.
  rawExecute(command, ...args) {
    return this._executeTokens([command, ...args])
  }

  // Silent execution: performs the command but does NOT broadcast the
  // 'command' event. Used by boss/NPC scripts that inject keys or mutate
  // state without the player earning XP or triggering command feedback.
  silentExecute(command, ...args) {
    this._silent = true
    let reply
    try {
      reply = this._executeTokens([command, ...args])
    } finally {
      this._silent = false
    }
    return reply
  }

  _executeTokens(tokens) {
    const name = String(tokens[0])
    const canon = name.toUpperCase()
    const command = registry.get(canon)
    const args = tokens

    if (!command) {
      this.stats.totalErrors++
      this.emit('error')
      return unknownCommand(name)
    }

    // arity check happens for all commands (also inside MULTI queueing)
    const arityErr = checkArity(command, args)
    if (arityErr) {
      this.stats.totalErrors++
      this.emit('error')
      if (this.multiQueue) this.multiError = true
      // broadcast so the companion/world can correct the syntax
      this.emit('command', { name: canon, args: tokens, reply: arityErr })
      return arityErr
    }

    // transaction queueing — everything except the transaction-control
    // commands themselves gets queued during MULTI.
    if (this.multiQueue && !TRANSACTION_CONTROL.has(canon)) {
      if (canon === 'SUBSCRIBE' || canon === 'PSUBSCRIBE' || canon === 'UNSUBSCRIBE') {
        this.stats.totalErrors++
        this.emit('error')
        return errorReply(`ERR ${canon} is not allowed in transactions`)
      }
      this.multiQueue.push(args)
      return simpleReply('QUEUED')
    }

    this._recordCommand(canon)

    let reply
    try {
      reply = command(this, args)
    } catch (err) {
      this.stats.totalErrors++
      this.emit('error')
      // eslint-disable-next-line no-console
      console.error('Engine handler error for', args[0], err)
      reply = errorReply(`ERR internal error: ${err.message}`)
    }
    if (reply && reply.type === 'error') this.stats.totalErrors++

    // Broadcast every executed command so the game world, boss and companion
    // can translate it into observable effects. Queued MULTI commands never
    // reach here (they return QUEUED above). `args` mirrors what the handler
    // received: [0] is the canonical command name.
    this.emit('command', { name: canon, args: tokens, reply })

    return reply
  }

  on(event, fn) {
    return this.emitter.on(event, fn)
  }
  off(event, fn) {
    this.emitter.off(event, fn)
  }
  emit(event, payload) {
    this.emitter.emit(event, payload)
  }
}

const TRANSACTION_CONTROL = new Set(['MULTI', 'EXEC', 'DISCARD', 'WATCH', 'UNWATCH', 'RESET'])

// Redis arity: positive = exact arg count (including command name),
// negative = minimum count. Returns an error reply or null.
export function checkArity(command, args) {
  const arity = command.arity
  if (arity === undefined) return null
  if (arity >= 0) {
    return args.length === arity ? null : wrongArity(command.displayName || command.name)
  }
  return args.length >= -arity ? null : wrongArity(command.displayName || command.name)
}

export function createEngine(opts) {
  return new MockRedisEngine(opts)
}
