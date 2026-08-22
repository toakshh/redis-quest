// CommandIntent — the ONE place a gameplay tool becomes a Redis command line.
// Sim layer: no three.js, no react, no DOM, no allocation concerns (called at
// most a handful of times per tick, gated by RedisActionBridge).
//
// Law: no other module may string-concatenate a Redis command. Every tool
// press, boss script, or scripted beat routes through buildIntent so there is
// a single audit point for what the player's actions actually execute.
//
// The tool → command mapping mirrors the design's tool table (plan §10.1).

// Canonical tool identifiers. Frozen so a typo throws instead of silently
// building the wrong command.
export const TOOLS = Object.freeze({
  PROBE: 'PROBE',
  STORE: 'STORE',
  TIMER: 'TIMER',
  PURGE: 'PURGE',
  RELEASE: 'RELEASE',
  ONESHOT: 'ONESHOT',
  CREW: 'CREW',
  TOLLGATE: 'TOLLGATE',
  SPREAD: 'SPREAD',
  ANCHOR: 'ANCHOR',
})

// Quote a token for the redis-cli-style parser only when it needs it — a
// value containing whitespace or quotes must be wrapped so splitArgs keeps it
// as one argument.
function tok(value) {
  const s = String(value)
  if (s.length === 0) return '""'
  if (!/[\s"']/.test(s)) return s
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function buildIntent(toolId, targetKey, modifiers = {}) {
  const key = tok(targetKey)
  let line

  switch (toolId) {
    case TOOLS.PROBE: {
      // Reads: GET by default; TYPE / TTL as alternate probes.
      const sub = (modifiers.probe || 'GET').toUpperCase()
      line = `${sub} ${key}`
      break
    }
    case TOOLS.STORE: {
      // Write cover into the world; SETEX when a lifetime is requested.
      const value = tok(modifiers.value ?? '1')
      if (modifiers.ttlSeconds != null) {
        line = `SETEX ${key} ${modifiers.ttlSeconds | 0} ${value}`
      } else {
        line = `SET ${key} ${value}`
      }
      break
    }
    case TOOLS.TIMER: {
      // Mark a hostile with a countdown. Prefer PEXPIRE when given ms.
      if (modifiers.ms != null) {
        line = `PEXPIRE ${key} ${modifiers.ms | 0}`
      } else {
        line = `EXPIRE ${key} ${(modifiers.seconds ?? 1) | 0}`
      }
      break
    }
    case TOOLS.PURGE:
      line = `DEL ${key}` // O(n) blocking removal — stalls proportionally
      break
    case TOOLS.RELEASE:
      line = `UNLINK ${key}` // asynchronous reclamation, no stall
      break
    case TOOLS.ONESHOT: {
      // An atomic action. Script provided by the beat; defaults to a no-op
      // that touches the single key so the arity is always valid.
      const script = tok(modifiers.script ?? 'return 1')
      line = `EVAL ${script} 1 ${key}`
      break
    }
    case TOOLS.CREW: {
      // Deploy workers (XADD) or claim their output (XREADGROUP-style read).
      if (modifiers.read) {
        line = `XLEN ${key}`
      } else {
        const field = tok(modifiers.field ?? 'task')
        const value = tok(modifiers.value ?? '1')
        line = `XADD ${key} * ${field} ${value}`
      }
      break
    }
    case TOOLS.TOLLGATE:
      // A rate-limit bucket: bump the counter for this window.
      line = `INCR ${key}`
      break
    case TOOLS.SPREAD:
      // Which slot does this key land on — used to reason about hot keys.
      line = `CLUSTER KEYSLOT ${key}`
      break
    case TOOLS.ANCHOR: {
      // Distributed lock with a fencing token and a lease.
      const token = tok(modifiers.token ?? '1')
      const ms = (modifiers.ms ?? 10000) | 0
      line = `SET ${key} ${token} NX PX ${ms}`
      break
    }
    default:
      throw new Error(`buildIntent: unknown toolId "${toolId}"`)
  }

  return { line, toolId, targetKey }
}
