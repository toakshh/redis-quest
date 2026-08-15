// HintEngine.js — 3-tier progressive hint system for Redis Quest
// Tier 1: Symptom (Observation / failure description)
// Tier 2: Concept (Redis data structure / operational mechanism)
// Tier 3: Command Shape (Exact command syntax template / pattern)

export const HINT_TIERS = {
  TIER1_SYMPTOM: 1,
  TIER2_CONCEPT: 2,
  TIER3_COMMAND_SHAPE: 3,
}

export const TIER_LABELS = {
  1: 'Tier 1: Symptom',
  2: 'Tier 2: Concept',
  3: 'Tier 3: Command Shape',
}

export const TIER_DESCRIPTIONS = {
  1: 'Symptom Diagnosis',
  2: 'Redis Concept',
  3: 'Command Syntax Shape',
}

// Built-in catalog of 3-tier hints keyed by situation / incident / command topic
export const DEFAULT_HINT_CATALOG = {
  'general:default': {
    tier1: 'System responses are unexpected or returning error status.',
    tier2: 'Redis requires precise key matching, exact command names, and valid data types.',
    tier3: 'COMMAND key [args...]',
  },
  'cache-invalidation-storm': {
    tier1: 'Cache miss rate spiked to 100% simultaneously across multiple application instances.',
    tier2: 'Mass expiration without jitter causes stampedes. Use random TTL offsets or pub/sub cache invalidation.',
    tier3: 'SET <key> <val> EX <seconds+jitter>',
  },
  'memory-leak': {
    tier1: 'RAM consumption is steadily climbing without keys expiring or being evicted.',
    tier2: 'Keys without TTL remain in memory forever. Check eviction policies (maxmemory-policy) and expire keys.',
    tier3: 'EXPIRE <key> <seconds>  or  CONFIG SET maxmemory-policy allkeys-lru',
  },
  'slow-queries': {
    tier1: 'Command execution latency exceeded SLA thresholds (>100ms per query).',
    tier2: 'O(N) operations like KEYS * or full SCAN block the single-threaded event loop.',
    tier3: 'SCAN <cursor> MATCH <pattern> COUNT <count>',
  },
  'rate-limiting': {
    tier1: 'Too many requests allowed in short windows, bypassing throttling rules.',
    tier2: 'Sliding window rate limiters use sorted sets (ZSET) scored by unix timestamp.',
    tier3: 'ZADD <limiter_key> <timestamp> <member_id>  then  ZREMRANGEBYSCORE ...',
  },
  'string-basics': {
    tier1: 'Unable to retrieve or manipulate key-value binary safe payload.',
    tier2: 'Strings are basic key-value pairs up to 512MB supporting atomic atomic increments.',
    tier3: 'SET <key> <val> [EX seconds] [NX|XX]',
  },
  'hash-structures': {
    tier1: 'Multiple related fields stored under separate top-level keys creating keyspace noise.',
    tier2: 'Hashes map string fields to string values, ideal for representing object entities.',
    tier3: 'HSET <key> <field> <value>  /  HGETALL <key>',
  },
  'list-queues': {
    tier1: 'Job processing worker thread blocked or missing item order guarantees.',
    tier2: 'Lists are double-linked chains supporting queue (LPUSH/RPOP) and stack operations.',
    tier3: 'LPUSH <queue_key> <job>  /  BRPOP <queue_key> <timeout>',
  },
  'set-algebra': {
    tier1: 'Duplicate values detected in collection or intersection calculation failed.',
    tier2: 'Sets contain unique unordered elements and support set operations (SINTER, SUNION, SDIFF).',
    tier3: 'SADD <set_key> <member>  /  SINTERSTORE <dest> <key1> <key2>',
  },
  'zset-rankings': {
    tier1: 'Leaderboard elements lack rank sorting or score ordering.',
    tier2: 'Sorted sets associate each unique member with a floating-point score.',
    tier3: 'ZADD <key> <score> <member>  /  ZRANGE <key> <min> <max> WITHSCORES',
  },
}

export class HintEngine {
  constructor(catalog = DEFAULT_HINT_CATALOG) {
    this.catalog = { ...catalog }
    this.tracking = new Map() // contextId -> { currentTier: 0, requestedCount: 0, history: [] }
    this.globalRequestCount = 0
  }

  // Register or update hint entry
  registerHint(contextId, hintData) {
    this.catalog[contextId] = {
      tier1: hintData.tier1 || hintData.symptom || 'Symptom observed in system state.',
      tier2: hintData.tier2 || hintData.concept || 'Redis conceptual mechanism.',
      tier3: hintData.tier3 || hintData.commandShape || hintData.command || 'COMMAND [args...]',
    }
  }

  // Request next tier hint for context
  requestHint(contextId = 'general:default') {
    this.globalRequestCount++

    let state = this.tracking.get(contextId)
    if (!state) {
      state = { currentTier: 0, requestedCount: 0, history: [] }
      this.tracking.set(contextId, state)
    }

    // Advance tier (1 -> 2 -> 3 -> 3)
    const nextTier = Math.min(3, state.currentTier + 1)
    state.currentTier = nextTier
    state.requestedCount++

    const hintObj = this.getHintForTier(contextId, nextTier)
    state.history.push({
      timestamp: Date.now(),
      tier: nextTier,
      hint: hintObj,
    })

    return hintObj
  }

  // Get specific tier hint without advancing tracking state unless specified
  getHintForTier(contextId = 'general:default', tier = 1) {
    const clampedTier = Math.max(1, Math.min(3, tier))
    const entry = this.catalog[contextId] || this._generateFallbackEntry(contextId)

    let text = ''
    let type = 'symptom'

    if (clampedTier === 1) {
      text = entry.tier1 || entry.symptom || 'Symptom: Unexpected behavior detected.'
      type = 'symptom'
    } else if (clampedTier === 2) {
      text = entry.tier2 || entry.concept || 'Concept: Verify data structure semantics.'
      type = 'concept'
    } else {
      text = entry.tier3 || entry.commandShape || entry.command || 'Command Shape: COMMAND <key> [args...]'
      type = 'command_shape'
    }

    return {
      contextId,
      tier: clampedTier,
      tierLabel: TIER_LABELS[clampedTier],
      tierDescription: TIER_DESCRIPTIONS[clampedTier],
      text,
      type,
      isMaxTier: clampedTier === 3,
    }
  }

  // Current tier for context
  getCurrentTier(contextId = 'general:default') {
    const state = this.tracking.get(contextId)
    return state ? state.currentTier : 0
  }

  // Reset tracking state for context or all
  resetTracking(contextId = null) {
    if (contextId) {
      this.tracking.delete(contextId)
    } else {
      this.tracking.clear()
      this.globalRequestCount = 0
    }
  }

  // Get tracking metrics
  getTrackingData() {
    return {
      globalRequests: this.globalRequestCount,
      contextsTracked: this.tracking.size,
      details: Object.fromEntries(
        [...this.tracking.entries()].map(([id, state]) => [id, { ...state }])
      ),
    }
  }

  _generateFallbackEntry(contextId) {
    const formattedName = contextId.replace(/[-_]/g, ' ')
    return {
      tier1: `Symptom: Operations in "${formattedName}" are failing or producing unexpected metrics.`,
      tier2: `Concept: Ensure proper Redis key design, TTL settings, and data structure commands for ${formattedName}.`,
      tier3: `Command Shape: HELP <command_name> or execute basic key query for ${formattedName}.`,
    }
  }
}

export const hintEngine = new HintEngine()
export default hintEngine
