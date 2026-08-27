// InputLog — a fixed-size ring buffer of (tick, intent) pairs. This is the
// authoritative record of everything the player did, and the input side of
// deterministic replay: feed the same seed + the same InputLog into the
// ReplayHarness and you must get an identical run.
//
// Sim layer: no three.js, no react, no DOM. The ring is pre-sized so a long
// session never reallocates; the oldest entries roll off once full.

export const INPUT_LOG_CAPACITY = 20_000

export function createInputLog({ capacity = INPUT_LOG_CAPACITY } = {}) {
  let ticks = new Int32Array(capacity)
  let intents = new Array(capacity).fill(null)
  let head = 0 // index of the next write
  let count = 0 // live entries, capped at capacity

  const log = {
    get capacity() { return capacity },
    get length() { return count },

    // Append one input. When the ring is full the oldest entry is overwritten.
    record(tick, intent) {
      ticks[head] = tick
      intents[head] = intent
      head = (head + 1) % capacity
      if (count < capacity) count += 1
    },

    // Entries oldest → newest as plain objects. Allocates — used by replay and
    // serialization, not in the hot loop.
    entries() {
      const out = new Array(count)
      const start = count < capacity ? 0 : head
      for (let i = 0; i < count; i++) {
        const idx = (start + i) % capacity
        out[i] = { tick: ticks[idx], intent: intents[idx] }
      }
      return out
    },

    serialize() {
      return JSON.stringify({ capacity, entries: this.entries() })
    },

    // Replace the log's contents from a serialize() string.
    deserialize(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      const cap = data.capacity || capacity
      if (cap !== capacity) {
        capacity = cap
        ticks = new Int32Array(capacity)
        intents = new Array(capacity).fill(null)
      }
      head = 0
      count = 0
      for (const e of data.entries) this.record(e.tick, e.intent)
      return this
    },

    clear() {
      head = 0
      count = 0
      intents.fill(null)
    },
  }

  return log
}
