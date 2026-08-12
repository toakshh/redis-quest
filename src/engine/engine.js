import { splitArgs } from './parser.js'
import { registry } from './registry.js'
import { unknownCommand, errorReply, simpleReply, wrongArity } from './reply.js'
import { totalMemoryBytes, MEMORY_CONSTANTS } from './datatypes/memory.js'
import { createRng } from './rng.js'

// How many executed commands we keep for time-travel debugging.
export const HISTORY_LIMIT = 500

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
  constructor({
    memoryLimit = MEMORY_CONSTANTS.DEFAULT_MEMORY_LIMIT,
    now = null,
    seed = null,
  } = {}) {
    this.databases = new Map()
    for (let i = 0; i < DB_COUNT; i++) this.databases.set(i, new Map())
    this.activeDb = 0
    this.memoryLimit = memoryLimit
    this._now = now // injectable clock for tests (null = real Date.now)
    this._rng = createRng(seed) // injectable deterministic PRNG (seed = fixed)
    this.emitter = new Emitter()

    // Command history for time-travel debugging / replay. Every executed (or
    // MULTI-queued) command is recorded with its reply, so a session can be
    // replayed against a fresh engine and compared.
    this.commandHistory = []
    this.commandSeq = 0

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

  // Deterministic randomness: uses the seeded PRNG when a seed was provided,
  // otherwise Math.random. Commands that need "random" (RANDOMKEY) go through
  // this so replaying the same seed reproduces the same reply.
  random() {
    return this._rng()
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
      this.emit('expired', { keys: [key] })
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
    const entry = { type, value: null, expiresAt: null, version: 0, lruTick: 0, lruTickTime: this.now() }
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
    entry.lruTickTime = this.now()
  }

  _bump(key, entry) {
    entry.version++
    entry.lruTick = this.stats.totalCommands
    entry.lruTickTime = this.now()
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
    const removedKeys = []
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.store.delete(key)
        removedKeys.push(key)
      }
    }
    if (removedKeys.length > 0) {
      this.stats.keysExpired += removedKeys.length
      this._cache.dirty = true
      this.emit('expired', { keys: removedKeys })
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
      const reply = errorReply(error)
      this._recordHistory(line, [], reply)
      return reply
    }
    if (tokens.length === 0) {
      return simpleReply('') // empty line -> nothing (redis-cli prints nothing)
    }
    const reply = this._executeTokens(tokens)
    this._recordHistory(line, tokens, reply)
    return reply
  }

  // Programmatic execution for mission validators / tests / boss waves.
  rawExecute(command, ...args) {
    const tokens = [command, ...args]
    const reply = this._executeTokens(tokens)
    this._recordHistory(tokens.join(' '), tokens, reply)
    return reply
  }

  // Record a command in the history ring buffer for time-travel / replay.
  _recordHistory(raw, tokens, reply) {
    const entry = {
      seq: this.commandSeq++,
      raw,
      command: tokens.length > 0 ? String(tokens[0]).toUpperCase() : '',
      args: tokens.slice(1).map(String),
      reply,
      timestamp: this.now(),
    }
    this.commandHistory.push(entry)
    if (this.commandHistory.length > HISTORY_LIMIT) this.commandHistory.shift()
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
      // Broadcast so the game world / REX companion can coach the syntax.
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

    if (!this._silent) {
      this.emit('command', { name: canon, args: tokens, reply })
    }

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

  // ---- persistence -------------------------------------------------------

  // JSON-safe snapshot of everything worth persisting. Container values (hash
  // fields, set members) are tagged so restore can rebuild the right types;
  // the remaining data is already plain JSON. Live internals (_cache, timers,
  // the emitter, injected clocks) are deliberately excluded and rebuilt.
  snapshot() {
    const databases = {}
    for (const [dbIndex, db] of this.databases) {
      const entries = {}
      for (const [key, entry] of db) {
        entries[key] = {
          type: entry.type,
          expiresAt: entry.expiresAt,
          version: entry.version,
          lruTick: entry.lruTick,
          value: serializeEntryValue(entry.value),
        }
      }
      databases[dbIndex] = entries
    }
    return {
      databases,
      activeDb: this.activeDb,
      stats: { ...this.stats },
      multiQueue: this.multiQueue ? this.multiQueue.map((line) => [...line]) : null,
      multiError: this.multiError,
      watchedKeys: this.watchedKeys ? [...this.watchedKeys.entries()] : [],
      scriptCache: this.scriptCache ? [...this.scriptCache.entries()] : [],
      subscribers: this.subscribers
        ? [...this.subscribers.entries()].map(([channel, conns]) => [channel, [...conns]])
        : [],
      connectionId: this.connectionId,
      memoryLimit: this.memoryLimit,
    }
  }

  // Restore state previously produced by snapshot(). Any current state is
  // replaced wholesale.
  restore(snap) {
    this.databases = new Map()
    for (const [dbIndex, entries] of Object.entries(snap.databases ?? {})) {
      const db = new Map()
      for (const [key, entry] of Object.entries(entries)) {
        db.set(key, {
          type: entry.type,
          value: deserializeEntryValue(entry.value),
          expiresAt: entry.expiresAt,
          version: entry.version,
          lruTick: entry.lruTick,
        })
      }
      this.databases.set(Number(dbIndex), db)
    }
    this.activeDb = snap.activeDb ?? 0
    this.stats = { ...this.stats, ...(snap.stats ?? {}) }
    this.multiQueue = snap.multiQueue ? snap.multiQueue.map((line) => [...line]) : null
    this.multiError = Boolean(snap.multiError)
    this.watchedKeys = new Map(snap.watchedKeys ?? [])
    this.scriptCache = new Map(snap.scriptCache ?? [])
    this.subscribers = new Map((snap.subscribers ?? []).map(([ch, conns]) => [ch, new Set(conns)]))
    if (typeof snap.memoryLimit === 'number') this.memoryLimit = snap.memoryLimit
    this._cache = { memoryBytes: 0, dirty: true }
    return this
  }
}

function serializeEntryValue(value) {
  if (value instanceof Map) return { __t: 'map', v: [...value] }
  if (value instanceof Set) return { __t: 'set', v: [...value] }
  return value
}

function deserializeEntryValue(value) {
  if (value && typeof value === 'object' && value.__t === 'map') return new Map(value.v)
  if (value && typeof value === 'object' && value.__t === 'set') return new Set(value.v)
  return value
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
