// Per-command latency estimate — models the cost a single-threaded Redis
// server would pay, so the sim layer can turn an expensive command into a
// real, felt frame stall instead of a free action (see plan section 13.4).
//
// Sizing note: DEL/UNLINK/FLUSHDB/FLUSHALL are destructive — by the time
// estimateCommandCost() runs (after the handler, per the call site in
// engine.js), the keys it needs to measure are already gone. engine.js
// therefore captures a `preSize` snapshot immediately before invoking the
// handler for exactly these commands and threads it through as an optional
// 5th argument; every other command is sized from live post-execution state
// (engine.store, or the reply itself for "how many items came back").

export const BASE_COST_MS = 0.05

export function elementCount(entry) {
  if (!entry) return 0
  switch (entry.type) {
    case 'string':
      return 1
    case 'hash':
    case 'set':
      return entry.value.size
    case 'list':
      return entry.value.length
    case 'zset':
      return entry.value.toArray().length
    case 'stream':
      return entry.value.entries.length
    default:
      return 0
  }
}

function replyItemCount(reply) {
  if (!reply || reply.type !== 'array') return 0
  return reply.value.length
}

export function estimateCommandCost(engine, canonicalName, args, reply, preSize = null) {
  switch (canonicalName) {
    case 'KEYS':
      return BASE_COST_MS + 0.002 * engine.store.size

    case 'SCAN':
    case 'HSCAN':
      return BASE_COST_MS + 0.0002 * engine.store.size

    case 'DEL':
    case 'UNLINK': {
      const cost = BASE_COST_MS + 0.0008 * (preSize ?? 0)
      return canonicalName === 'UNLINK' ? Math.min(cost, BASE_COST_MS * 2) : cost
    }

    case 'LRANGE':
    case 'SMEMBERS':
    case 'HGETALL':
    case 'ZRANGE':
    case 'XRANGE':
      return BASE_COST_MS + 0.0008 * replyItemCount(reply)

    case 'FLUSHDB':
    case 'FLUSHALL':
      return BASE_COST_MS + 0.0008 * (preSize ?? engine.store.size)

    case 'EVAL': {
      const script = args[1] !== undefined ? String(args[1]) : ''
      const lineCount = script.split('\n').length
      return BASE_COST_MS + 0.01 * lineCount
    }

    case 'DEBUG': {
      if (String(args[1] || '').toUpperCase() === 'SLEEP') {
        const seconds = Number(args[2]) || 0
        return seconds * 1000
      }
      return BASE_COST_MS
    }

    default:
      return BASE_COST_MS
  }
}

// Commands whose cost model needs a pre-execution size snapshot (see the
// module header). engine.js checks this set before dispatching a handler.
export const PRE_SIZE_COMMANDS = new Set(['DEL', 'UNLINK', 'FLUSHDB', 'FLUSHALL'])

export function capturePreSize(engine, canonicalName, args) {
  if (canonicalName === 'DEL' || canonicalName === 'UNLINK') {
    let total = 0
    for (let i = 1; i < args.length; i++) {
      total += elementCount(engine.store.get(args[i]))
    }
    return total
  }
  if (canonicalName === 'FLUSHDB' || canonicalName === 'FLUSHALL') {
    return engine.store.size
  }
  return null
}
