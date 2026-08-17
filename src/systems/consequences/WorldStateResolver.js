/**
 * WorldStateResolver.js
 * State adapter mapping Redis keys and data structures to high-level game entity states.
 * Allows UI and canvas renderers to inspect resolved world states without raw Redis key checks.
 */

export function getEngineEntry(engine, key) {
  if (!engine || !key) return null
  if (typeof engine._get === 'function') {
    return engine._get(key)
  }
  if (engine.databases && typeof engine.activeDb === 'number') {
    const db = engine.databases.get(engine.activeDb)
    if (db && db.has(key)) {
      const entry = db.get(key)
      if (entry && entry.expiresAt !== null && typeof engine.now === 'function') {
        if (entry.expiresAt <= engine.now()) return null
      }
      return entry
    }
  }
  if (engine.store && typeof engine.store.get === 'function') {
    const entry = engine.store.get(key)
    if (entry && entry.expiresAt !== null && typeof engine.now === 'function') {
      if (entry.expiresAt <= engine.now()) return null
    }
    return entry || null
  }
  return null
}

export function getListItems(entry) {
  if (!entry || entry.type !== 'list' || !entry.value) return []
  if (Array.isArray(entry.value)) return [...entry.value]
  if (typeof entry.value.toArray === 'function') return entry.value.toArray()
  return []
}

export function getSetMembers(entry) {
  if (!entry || entry.type !== 'set' || !entry.value) return []
  if (entry.value instanceof Set) return Array.from(entry.value)
  if (Array.isArray(entry.value)) return [...entry.value]
  return []
}

export function getHashData(entry) {
  if (!entry || entry.type !== 'hash' || !entry.value) return {}
  const result = {}
  if (typeof entry.value.entries === 'function') {
    for (const [k, v] of entry.value.entries()) {
      result[k] = String(v)
    }
  } else if (entry.value instanceof Map) {
    for (const [k, v] of entry.value.entries()) {
      result[k] = String(v)
    }
  } else if (typeof entry.value === 'object') {
    for (const [k, v] of Object.entries(entry.value)) {
      result[k] = String(v)
    }
  }
  return result
}

export function getZSetEntries(entry) {
  if (!entry || entry.type !== 'zset' || !entry.value) return []
  if (typeof entry.value.toArray === 'function') {
    return entry.value.toArray().map((node) => ({
      member: String(node.member),
      score: Number(node.score),
    }))
  }
  if (Array.isArray(entry.value)) return [...entry.value]
  return []
}

/**
 * Resolves the state of a gate entity from Redis.
 * Supports string values ('locked', 'unlocked', 'open', 'closed') or sets (keys/tokens).
 */
export function resolveGateState(engine, key = 'api:gate:mode') {
  const candidateKeys = [key, 'api:gate:mode', 'gate:mode', 'ward:gate', 'gate']
  let entry = null
  let actualKey = key

  for (const k of candidateKeys) {
    const found = getEngineEntry(engine, k)
    if (found) {
      entry = found
      actualKey = k
      break
    }
  }

  if (!entry) {
    return {
      key: actualKey,
      mode: 'locked',
      isLocked: true,
      isOpen: false,
      rawValue: null,
      exists: false,
    }
  }

  if (entry.type === 'string') {
    const val = String(entry.value).trim().toLowerCase()
    const isLocked = val === 'locked' || val === 'closed' || val === 'false' || val === '0'
    const isOpen = val === 'open' || val === 'unlocked' || val === 'true' || val === '1'
    const mode = isLocked ? 'locked' : (isOpen ? 'unlocked' : val)

    return {
      key: actualKey,
      mode,
      isLocked,
      isOpen,
      rawValue: entry.value,
      exists: true,
    }
  }

  if (entry.type === 'set') {
    const members = getSetMembers(entry)
    const isOpen = members.length > 0
    const isLocked = !isOpen

    return {
      key: actualKey,
      mode: isOpen ? 'unlocked' : 'locked',
      isLocked,
      isOpen,
      members,
      rawValue: entry.value,
      exists: true,
    }
  }

  return {
    key: actualKey,
    mode: 'unknown',
    isLocked: false,
    isOpen: false,
    rawValue: entry.value,
    exists: true,
  }
}

/**
 * Resolves shield system state (active/inactive, power level).
 */
export function resolveShieldState(engine, key = 'shield:status') {
  const candidateKeys = [key, 'shield:status', 'shield:power', 'shield:energy', 'shield:config', 'shield']
  let entry = null
  let actualKey = key

  for (const k of candidateKeys) {
    const found = getEngineEntry(engine, k)
    if (found) {
      entry = found
      actualKey = k
      break
    }
  }

  if (!entry) {
    return {
      key: actualKey,
      active: false,
      power: 0,
      status: 'inactive',
      rawValue: null,
      exists: false,
    }
  }

  if (entry.type === 'string') {
    const val = String(entry.value).trim().toLowerCase()
    const isNum = !isNaN(val) && val !== ''

    if (isNum) {
      const power = Number(val)
      const active = power > 0
      return {
        key: actualKey,
        active,
        power,
        status: active ? 'active' : 'depleted',
        rawValue: entry.value,
        exists: true,
      }
    }

    const active = val === 'active' || val === 'online' || val === 'enabled' || val === 'shielded' || val === 'true'
    const status = active ? 'active' : (val === 'disabled' || val === 'down' || val === 'off' ? 'inactive' : val)
    const power = active ? 100 : 0

    return {
      key: actualKey,
      active,
      power,
      status,
      rawValue: entry.value,
      exists: true,
    }
  }

  if (entry.type === 'hash') {
    const hash = getHashData(entry)
    const statusStr = (hash.status || '').toLowerCase()
    const powerNum = Number(hash.power || hash.energy || 0)

    const active = statusStr === 'active' || statusStr === 'online' || powerNum > 0
    const status = statusStr || (active ? 'active' : 'inactive')
    const power = isNaN(powerNum) ? (active ? 100 : 0) : powerNum

    return {
      key: actualKey,
      active,
      power,
      status,
      hash,
      rawValue: entry.value,
      exists: true,
    }
  }

  return {
    key: actualKey,
    active: false,
    power: 0,
    status: 'unknown',
    rawValue: entry.value,
    exists: true,
  }
}

/**
 * Resolves queue state (length, head, tail, items).
 */
export function resolveQueueState(engine, key = 'task:queue') {
  const candidateKeys = [key, 'task:queue', 'queue:items', 'job:queue', 'queue']
  let entry = null
  let actualKey = key

  for (const k of candidateKeys) {
    const found = getEngineEntry(engine, k)
    if (found) {
      entry = found
      actualKey = k
      break
    }
  }

  if (!entry || entry.type !== 'list') {
    return {
      key: actualKey,
      length: 0,
      items: [],
      isEmpty: true,
      head: null,
      tail: null,
      rawValue: entry ? entry.value : null,
      exists: Boolean(entry),
    }
  }

  const items = getListItems(entry)
  const length = items.length
  const isEmpty = length === 0
  const head = length > 0 ? items[0] : null
  const tail = length > 0 ? items[length - 1] : null

  return {
    key: actualKey,
    length,
    items,
    isEmpty,
    head,
    tail,
    rawValue: entry.value,
    exists: true,
  }
}

/**
 * Resolves leaderboard/sorted set state.
 */
export function resolveLeaderboardState(engine, key = 'leaderboard') {
  const candidateKeys = [key, 'leaderboard', 'arena:scores', 'scores', 'rankings']
  let entry = null
  let actualKey = key

  for (const k of candidateKeys) {
    const found = getEngineEntry(engine, k)
    if (found) {
      entry = found
      actualKey = k
      break
    }
  }

  if (!entry || entry.type !== 'zset') {
    return {
      key: actualKey,
      count: 0,
      entries: [],
      top: [],
      isEmpty: true,
      rawValue: entry ? entry.value : null,
      exists: Boolean(entry),
    }
  }

  const entries = getZSetEntries(entry)
  const count = entries.length
  const isEmpty = count === 0
  const top = entries.slice(0, 10)

  return {
    key: actualKey,
    count,
    entries,
    top,
    isEmpty,
    rawValue: entry.value,
    exists: true,
  }
}

/**
 * Resolves full world state object from engine.
 */
export function resolveWorldState(engine, options = {}) {
  return {
    gate: resolveGateState(engine, options.gateKey),
    shield: resolveShieldState(engine, options.shieldKey),
    queue: resolveQueueState(engine, options.queueKey),
    leaderboard: resolveLeaderboardState(engine, options.leaderboardKey),
    timestamp: engine && typeof engine.now === 'function' ? engine.now() : Date.now(),
  }
}

export class WorldStateResolver {
  constructor(engine = null, options = {}) {
    this.engine = engine
    this.options = options
  }

  setEngine(engine) {
    this.engine = engine
  }

  resolveGateState(key = this.options.gateKey) {
    return resolveGateState(this.engine, key)
  }

  resolveShieldState(key = this.options.shieldKey) {
    return resolveShieldState(this.engine, key)
  }

  resolveQueueState(key = this.options.queueKey) {
    return resolveQueueState(this.engine, key)
  }

  resolveLeaderboardState(key = this.options.leaderboardKey) {
    return resolveLeaderboardState(this.engine, key)
  }

  resolveWorldState(options = {}) {
    return resolveWorldState(this.engine, { ...this.options, ...options })
  }

  static resolveGateState = resolveGateState
  static resolveShieldState = resolveShieldState
  static resolveQueueState = resolveQueueState
  static resolveLeaderboardState = resolveLeaderboardState
  static resolveWorldState = resolveWorldState
}
