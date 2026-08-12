// Unified EventBus supporting both rich typed subscriptions (pattern, once, filter, seq)
// and simple event-name maps for REX / Progression / Juice hooks.

const DEFAULT_LOG_SIZE = 500

export function typePattern(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const globbed = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${globbed}$`)
}

export class EventBus {
  constructor({ logSize = DEFAULT_LOG_SIZE } = {}) {
    this._handlers = [] // [{ pattern, regex, fn, filter, once }]
    this._seq = 0
    this._log = []
    this._logSize = logSize
    this._simpleHandlers = new Map()
    this._wildcards = new Set()
  }

  subscribe(type, fn, opts = {}) {
    const entry = {
      pattern: type,
      regex: typePattern(type),
      fn,
      filter: opts.filter || null,
      once: Boolean(opts.once),
    }
    this._handlers.push(entry)
    return () => this.unsubscribe(entry)
  }

  on(type, fn, opts) {
    if (typeof fn === 'function' && (!opts || typeof opts === 'object')) {
      if (type === '*') {
        this._wildcards.add(fn)
        return () => this._wildcards.delete(fn)
      }
      if (!opts || Object.keys(opts).length === 0) {
        if (!this._simpleHandlers.has(type)) this._simpleHandlers.set(type, new Set())
        this._simpleHandlers.get(type).add(fn)
        return () => this._simpleHandlers.get(type)?.delete(fn)
      }
    }
    return this.subscribe(type, fn, opts)
  }

  once(type, fn) {
    return this.subscribe(type, fn, { once: true })
  }

  unsubscribe(entry) {
    const i = this._handlers.indexOf(entry)
    if (i !== -1) this._handlers.splice(i, 1)
  }

  off(type, fn) {
    this._handlers = this._handlers.filter(
      (e) => e.pattern !== type || (fn && e.fn !== fn),
    )
    if (this._simpleHandlers.has(type)) {
      if (fn) this._simpleHandlers.get(type).delete(fn)
      else this._simpleHandlers.delete(type)
    }
  }

  emit(event, payload) {
    if (typeof event === 'string') {
      const set = this._simpleHandlers.get(event)
      if (set) for (const fn of set) fn(payload)

      event = { type: event, payload: payload || {} }
    }
    if (!event || typeof event.type !== 'string') {
      throw new Error('EventBus.emit requires an event with a string type')
    }
    const normalized = {
      type: event.type,
      seq: this._seq++,
      timestamp: event.timestamp != null ? event.timestamp : Date.now(),
      source: event.source || 'unknown',
      payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
    }
    this._log.push(normalized)
    if (this._log.length > this._logSize) this._log.shift()

    for (const fn of this._wildcards) fn(normalized)

    for (const entry of [...this._handlers]) {
      if (!entry.regex.test(normalized.type)) continue
      if (entry.filter && !entry.filter(normalized)) continue
      if (entry.once) this.unsubscribe(entry)
      entry.fn(normalized)
    }
    return normalized
  }

  publish(type, payload = {}, source = 'unknown') {
    return this.emit({ type, payload, source })
  }

  recent(n = 10) {
    return this._log.slice(-n).reverse()
  }

  get log() {
    return this._log
  }

  get seq() {
    return this._seq
  }

  toJSON() {
    return this._log.map((e) => ({ ...e, payload: { ...e.payload } }))
  }

  clear() {
    this._log = []
    this._seq = 0
    this._handlers = []
    this._simpleHandlers.clear()
    this._wildcards.clear()
  }

  get handlerCount() {
    return this._handlers.length + this._simpleHandlers.size + this._wildcards.size
  }
}

export function createEventBus(opts) {
  return new EventBus(opts)
}

export const eventBus = new EventBus()

export const EVENTS = {
  XP_GAINED: 'xp:gained',
  LEVEL_UP: 'level:up',
  COMMAND_EXECUTED: 'command:executed',
  COMMAND_FAILED: 'command:failed',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ACHIEVEMENT_PROGRESS: 'achievement:progress',
  BOSS_ENGAGED: 'boss:engaged',
  BOSS_DAMAGED: 'boss:damaged',
  BOSS_DEFEATED: 'boss:defeated',
  SKILL_UNLOCKED: 'skill:unlocked',
  SKILL_RESET: 'skill:reset',
  REGION_UNLOCKED: 'region:unlocked',
  REGION_ENTERED: 'region:entered',
  GATEWAY_ACTIVATED: 'gateway:activated',
  COSMETIC_UNLOCKED: 'cosmetic:unlocked',
  COSMETIC_EQUIPPED: 'cosmetic:equipped',
  SCREEN_SHAKE: 'juice:shake',
  HIT_PAUSE: 'juice:hitpause',
  PARTICLE_BURST: 'juice:particles',
  FLASH: 'juice:flash',
  GAME_SAVED: 'save:saved',
  GAME_LOADED: 'save:loaded',
  GAME_RESET: 'save:reset',
  MODE_CHANGED: 'settings:mode',
  TUTORIAL_STEP_COMPLETED: 'tutorial:stepCompleted',
  TUTORIAL_COMPLETED: 'tutorial:completed',
  REX_SAID: 'rex:said',
  REX_HINT: 'rex:hint',
}
