// EventBus — the typed, lightweight pub/sub spine of the game.
//
// The whole game is driven by events: the terminal runs a Redis command, the
// bridge translates it into typed events, and game systems react. This bus is
// the pipe between all of them, and it is deliberately small (<5kb gzipped)
// and dependency-free.
//
// Features:
//   - typed events: every event carries a string `type`
//   - wildcard / glob subscriptions: on('VisualEffect*', ...) or on('*', ...)
//   - filtering: subscribe(type, handler, { filter }) skips events that fail
//   - once() subscriptions that auto-remove after one delivery
//   - serializable: events are plain objects with a monotonic `seq` so a
//     session can be recorded and replayed for debugging
//
// 7th-grade analogy: the event bus is the school PA system. Someone shouts
// a message ("the dragon escaped!"), and everyone who asked to hear *that
// kind* of message hears it — nobody else gets interrupted.

const DEFAULT_LOG_SIZE = 500

// Convert a glob-style type pattern ("VisualEffect*", "*", "Redis*") into a
// RegExp. Also matches exact types (no wildcards).
export function typePattern(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const globbed = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${globbed}$`)
}

export class EventBus {
  /**
   * @param {{ logSize?: number }} [opts]
   */
  constructor({ logSize = DEFAULT_LOG_SIZE } = {}) {
    this._handlers = [] // [{ pattern, regex, fn, filter, once }]
    this._seq = 0
    this._log = []
    this._logSize = logSize
  }

  /**
   * Subscribe to an event type (exact, glob, or '*'). Returns an unsubscribe
   * function.
   *
   * @param {string} type
   * @param {(event: object) => void} fn
   * @param {{ filter?: (event: object) => boolean, once?: boolean }} [opts]
   */
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

  /** Alias for subscribe. */
  on(type, fn, opts) {
    return this.subscribe(type, fn, opts)
  }

  /** Subscribe once; auto-removed after the first matching event. */
  once(type, fn) {
    return this.subscribe(type, fn, { once: true })
  }

  unsubscribe(entry) {
    const i = this._handlers.indexOf(entry)
    if (i !== -1) this._handlers.splice(i, 1)
  }

  off(type, fn) {
    // Remove every handler for `type` (with fn), or all handlers if fn is
    // omitted. `type` is matched literally against the registered pattern.
    this._handlers = this._handlers.filter(
      (e) => e.pattern !== type || (fn && e.fn !== fn),
    )
  }

  /**
   * Publish an event. Accepts a full event object { type, payload, source }
   * or a type string. Assigns the sequence number and timestamp if missing,
   * appends to the rolling log, then dispatches to every matching handler.
   */
  emit(event) {
    if (typeof event === 'string') event = { type: event, payload: {} }
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

    for (const entry of this._handlers) {
      if (!entry.regex.test(normalized.type)) continue
      if (entry.filter && !entry.filter(normalized)) continue
      if (entry.once) this.unsubscribe(entry)
      entry.fn(normalized)
    }
    return normalized
  }

  /** Convenience: publish(type, payload, source). */
  publish(type, payload = {}, source = 'unknown') {
    return this.emit({ type, payload, source })
  }

  /** Most recent events, newest first (up to n). */
  recent(n = 10) {
    return this._log.slice(-n).reverse()
  }

  get log() {
    return this._log
  }

  get seq() {
    return this._seq
  }

  /** Deep-ish copy of the log, ready for JSON.stringify. */
  toJSON() {
    return this._log.map((e) => ({ ...e, payload: { ...e.payload } }))
  }

  clear() {
    this._log = []
    this._seq = 0
  }

  get handlerCount() {
    return this._handlers.length
  }
}

export function createEventBus(opts) {
  return new EventBus(opts)
}
