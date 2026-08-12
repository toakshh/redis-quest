// RedisGameBridge — the core Redis -> game integration.
//
// The bridge sits between the MockRedisEngine and the game's EventBus. It
// turns the engine's low-level mutation events into the typed game events the
// renderer and systems consume:
//
//   engine 'command'/'expired' events
//        │
//        ▼
//   RedisGameBridge ──► EventBus
//        │                ├─ RedisCommandExecuted   (every command line)
//        │                ├─ RedisStateChanged      (key created/updated/deleted)
//        │                └─ VisualEffectRequested  (one effect per command)
//
// Effects are chosen per command family so the world reacts to what the
// player typed: SET crystallises a key, INCR pulses a counter ring, LPUSH
// slides a crate into a queue, PUBLISH ripples radio waves, and an error
// raises a red teaching ripple.
//
// To know *which* keys changed we don't touch every command handler — the
// bridge keeps a serialized snapshot of the store and diffs it after each
// command. Small stores, cheap diff, and it works even for EXEC batches that
// mutate many keys in one go.

import { EVENT_TYPES, EFFECT_KINDS } from './GameEvents.js'
import { serializeEntry, valuesEqual } from './serialize.js'

// Command name -> effect family. Unmapped commands fall back to COMMAND_ECHO.
// Write commands on a brand-new key are refined to CRYSTAL_FORM via the
// snapshot; the entry below is the default for existing writes.
const COMMAND_EFFECTS = {
  // ---- strings ----
  SET: EFFECT_KINDS.CRYSTAL_PULSE,
  SETEX: EFFECT_KINDS.CRYSTAL_PULSE,
  PSETEX: EFFECT_KINDS.CRYSTAL_PULSE,
  SETNX: EFFECT_KINDS.CRYSTAL_FORM,
  GETSET: EFFECT_KINDS.CRYSTAL_PULSE,
  APPEND: EFFECT_KINDS.CRYSTAL_PULSE,
  MSET: EFFECT_KINDS.CRYSTAL_PULSE,
  GET: EFFECT_KINDS.RETRIEVE_BEAM,
  GETRANGE: EFFECT_KINDS.RETRIEVE_BEAM,
  STRLEN: EFFECT_KINDS.RETRIEVE_BEAM,
  MGET: EFFECT_KINDS.RETRIEVE_BEAM,
  INCR: EFFECT_KINDS.COUNTER_PULSE,
  DECR: EFFECT_KINDS.COUNTER_PULSE,
  INCRBY: EFFECT_KINDS.COUNTER_PULSE,
  DECRBY: EFFECT_KINDS.COUNTER_PULSE,
  // ---- keys ----
  DEL: EFFECT_KINDS.SHATTER,
  UNLINK: EFFECT_KINDS.SHATTER,
  EXPIRE: EFFECT_KINDS.COUNTDOWN_HALO,
  PEXPIRE: EFFECT_KINDS.COUNTDOWN_HALO,
  EXPIREAT: EFFECT_KINDS.COUNTDOWN_HALO,
  PEXPIREAT: EFFECT_KINDS.COUNTDOWN_HALO,
  PERSIST: EFFECT_KINDS.CANCEL_HALO,
  RENAME: EFFECT_KINDS.CRYSTAL_MOVE,
  TTL: EFFECT_KINDS.RETRIEVE_BEAM,
  PTTL: EFFECT_KINDS.RETRIEVE_BEAM,
  TYPE: EFFECT_KINDS.RETRIEVE_BEAM,
  EXISTS: EFFECT_KINDS.RETRIEVE_BEAM,
  KEYS: EFFECT_KINDS.RETRIEVE_BEAM,
  // ---- hashes ----
  HSET: EFFECT_KINDS.FIELD_FLASH,
  HMSET: EFFECT_KINDS.FIELD_FLASH,
  HSETNX: EFFECT_KINDS.FIELD_FLASH,
  HDEL: EFFECT_KINDS.FIELD_FLASH,
  HINCRBY: EFFECT_KINDS.COUNTER_PULSE,
  HINCRBYFLOAT: EFFECT_KINDS.COUNTER_PULSE,
  HGET: EFFECT_KINDS.RETRIEVE_BEAM,
  HMGET: EFFECT_KINDS.RETRIEVE_BEAM,
  HGETALL: EFFECT_KINDS.RETRIEVE_BEAM,
  HLEN: EFFECT_KINDS.RETRIEVE_BEAM,
  // ---- lists ----
  LPUSH: EFFECT_KINDS.QUEUE_SLIDE,
  RPUSH: EFFECT_KINDS.QUEUE_SLIDE,
  LPOP: EFFECT_KINDS.QUEUE_POP,
  RPOP: EFFECT_KINDS.QUEUE_POP,
  LRANGE: EFFECT_KINDS.RETRIEVE_BEAM,
  LLEN: EFFECT_KINDS.RETRIEVE_BEAM,
  // ---- sets ----
  SADD: EFFECT_KINDS.ORBIT_JOIN,
  SREM: EFFECT_KINDS.ORBIT_LEAVE,
  SPOP: EFFECT_KINDS.ORBIT_LEAVE,
  SISMEMBER: EFFECT_KINDS.RETRIEVE_BEAM,
  SINTER: EFFECT_KINDS.RETRIEVE_BEAM,
  SUNION: EFFECT_KINDS.RETRIEVE_BEAM,
  SCARD: EFFECT_KINDS.RETRIEVE_BEAM,
  SMEMBERS: EFFECT_KINDS.RETRIEVE_BEAM,
  // ---- sorted sets ----
  ZADD: EFFECT_KINDS.LEADERBOARD_MOVE,
  ZINCRBY: EFFECT_KINDS.LEADERBOARD_MOVE,
  ZREM: EFFECT_KINDS.ORBIT_LEAVE,
  ZRANGE: EFFECT_KINDS.RETRIEVE_BEAM,
  ZREVRANGE: EFFECT_KINDS.RETRIEVE_BEAM,
  ZSCORE: EFFECT_KINDS.RETRIEVE_BEAM,
  ZCARD: EFFECT_KINDS.RETRIEVE_BEAM,
  // ---- pub/sub ----
  PUBLISH: EFFECT_KINDS.RADIO_WAVE,
}

// Commands that "create" a key when absent but mutate it when present. The
// bridge refines these to CRYSTAL_FORM (new key crystallises) vs the mapped
// effect (existing value pulses/flashes) using its snapshot.
const CREATE_OR_WRITE = new Set(['SET', 'SETEX', 'PSETEX', 'MSET', 'APPEND', 'HSET', 'HMSET', 'LPUSH', 'RPUSH', 'SADD', 'ZADD'])

const NEW_KEY_EFFECT = {
  [EFFECT_KINDS.CRYSTAL_PULSE]: EFFECT_KINDS.CRYSTAL_FORM,
  [EFFECT_KINDS.FIELD_FLASH]: EFFECT_KINDS.CRYSTAL_FORM,
  [EFFECT_KINDS.QUEUE_SLIDE]: EFFECT_KINDS.CRYSTAL_FORM,
  [EFFECT_KINDS.ORBIT_JOIN]: EFFECT_KINDS.CRYSTAL_FORM,
  [EFFECT_KINDS.LEADERBOARD_MOVE]: EFFECT_KINDS.CRYSTAL_FORM,
}

// The keys a command writes to (for effect targeting). Positional and stable
// across the commands we map; multi-key writers target each key so the world
// reacts at every site.
function commandKeys(command, args) {
  if (command === 'MSET') {
    // args = [k1, v1, k2, v2, ...] — keys are the even-index args.
    const out = []
    for (let i = 0; i < args.length; i += 2) out.push(args[i])
    return out
  }
  return args.length > 0 ? [args[0]] : []
}

export class RedisGameBridge {
  /**
   * @param {object} opts
   * @param {import('./engine.js').MockRedisEngine} opts.engine
   * @param {import('./EventBus.js').EventBus} opts.eventBus
   * @param {import('./regions.js').REGIONS[number]} [opts.region] current world region
   */
  constructor({ engine, eventBus, region = null }) {
    this.engine = engine
    this.eventBus = eventBus
    this.region = region

    // Serialized snapshot of the active store (key -> serializeEntry), kept
    // up to date so each command diffs against the previous state.
    this._snapshot = null
    this._unsubs = []
  }

  /** Subscribe to engine events and start translating. Returns this. */
  start() {
    if (this._unsubs.length > 0) return this
    this._snapshot = this._takeSnapshot()
    this._unsubs.push(this.engine.on('command', (ev) => this._onCommand(ev)))
    this._unsubs.push(this.engine.on('expired', (ev) => this._onExpired(ev)))
    return this
  }

  /** Detach from the engine. Safe to call repeatedly. */
  stop() {
    for (const un of this._unsubs) un()
    this._unsubs = []
    this._snapshot = null
  }

  _emit(event) {
    this.eventBus.emit(event)
  }

  _onCommand(ev) {
    const commandName = ev.command || ev.name
    const rawArgs = ev.args || []
    const positionalArgs =
      rawArgs.length > 0 && String(rawArgs[0]).toUpperCase() === commandName
        ? rawArgs.slice(1)
        : rawArgs

    // 1. Every executed line becomes a RedisCommandExecuted event.
    this._emit({
      type: EVENT_TYPES.REDIS_COMMAND_EXECUTED,
      source: 'engine',
      payload: {
        seq: ev.seq,
        command: commandName,
        args: positionalArgs,
        raw: ev.raw || [commandName, ...positionalArgs].join(' '),
        reply: ev.reply,
        timestamp: ev.timestamp || Date.now(),
      },
    })

    const reply = ev.reply

    // A queued command (MULTI) hasn't run yet — nothing to visualise or diff.
    if (reply && reply.type === 'simple' && reply.value === 'QUEUED') {
      return
    }

    // 2. Errors raise a red teaching ripple instead of an effect.
    if (reply && reply.type === 'error') {
      this._emit({
        type: EVENT_TYPES.VISUAL_EFFECT_REQUESTED,
        source: 'bridge',
        payload: {
          effect: EFFECT_KINDS.ERROR_RIPPLE,
          command: commandName,
          args: positionalArgs,
          error: reply.value,
        },
      })
      return
    }

    // 3. Pick and emit a visual effect for the command.
    const effect = this._effectFor(commandName, positionalArgs, reply)
    if (effect) {
      for (const key of commandKeys(commandName, positionalArgs)) {
        this._emit({
          type: EVENT_TYPES.VISUAL_EFFECT_REQUESTED,
          source: 'bridge',
          payload: {
            effect,
            command: commandName,
            args: positionalArgs,
            key,
          },
        })
      }
    }

    // 4. Diff the store against the previous snapshot.
    if (!this.engine.multiExecuting) {
      this._emitStateChanges()
    }
  }

  _onExpired(ev) {
    const changes = (ev.keys || []).map((key) => ({ key, type: 'deleted', entry: null }))
    if (changes.length === 0) return
    // Keep the snapshot consistent so a later diff doesn't re-report them.
    if (this._snapshot) for (const key of ev.keys) this._snapshot.delete(key)
    for (const key of ev.keys) {
      this._emit({
        type: EVENT_TYPES.VISUAL_EFFECT_REQUESTED,
        source: 'bridge',
        payload: { effect: EFFECT_KINDS.POOF, command: 'EXPIRE', args: [key], key },
      })
    }
    this._emit({
      type: EVENT_TYPES.REDIS_STATE_CHANGED,
      source: 'engine',
      payload: { changes, expired: true },
    })
  }

  // Pick the effect for a command+reply, refining "existing write" into
  // "new key crystallises" via the pre-command snapshot.
  _effectFor(command, args, reply) {
    const base = COMMAND_EFFECTS[command]
    if (!base) return EFFECT_KINDS.COMMAND_ECHO

    // NX/XX guards that refused the write return nil — no effect to show.
    if (reply && reply.type === 'nil') return null
    // DEL/UNLINK that removed nothing return 0 — nothing shattered.
    if ((command === 'DEL' || command === 'UNLINK') && reply && reply.type === 'integer' && reply.value === 0) {
      return null
    }

    const keys = commandKeys(command, args)
    if (CREATE_OR_WRITE.has(command) && this._snapshot) {
      const allNew = keys.length > 0 && keys.every((k) => !this._snapshot.has(k))
      if (allNew) return NEW_KEY_EFFECT[base] || base
    }
    return base
  }

  // ---- snapshot diff ----------------------------------------------------

  _takeSnapshot() {
    const out = new Map()
    for (const [key, entry] of this.engine.store) {
      out.set(key, serializeEntry(entry))
    }
    return out
  }

  // Emit one RedisStateChanged with created/updated/deleted keys since the
  // last command. Serialized values only — plain JSON-safe payloads.
  _emitStateChanges() {
    const before = this._snapshot || new Map()
    const after = this._takeSnapshot()
    const changes = []

    for (const [key, entry] of after) {
      const prev = before.get(key)
      if (!prev) {
        changes.push({ key, type: 'created', entry })
      } else if (!valuesEqual(prev.value, entry.value) || prev.expiresAt !== entry.expiresAt) {
        changes.push({ key, type: 'updated', entry })
      }
    }
    for (const key of before.keys()) {
      if (!after.has(key)) changes.push({ key, type: 'deleted', entry: null })
    }

    this._snapshot = after
    if (changes.length > 0) {
      this._emit({
        type: EVENT_TYPES.REDIS_STATE_CHANGED,
        source: 'bridge',
        payload: { changes },
      })
    }
  }
}

export function createRedisBridge(opts) {
  return new RedisGameBridge(opts)
}
