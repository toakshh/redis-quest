/**
 * HintEngine.js
 * 
 * 3-Tier Progressive Hint Engine and Contextual Dialogue System for Redis Quest.
 * 
 * Tiers:
 * - Tier 1 (Observation): Highlights symptom (e.g. "The session is surviving longer than it should.")
 * - Tier 2 (Concept): Points to Redis concept (e.g. "Check whether this key has an expiration time.")
 * - Tier 3 (Command Shape): Shows command structure (e.g. "TTL <key>")
 * 
 * Tracks hint usage per incident to feed into score penalties.
 * Provides REX dialogue trigger handlers:
 * - onSymptom(symptomId)
 * - onCommandResult(cmd, result, isError)
 * - getHint(incidentId, level)
 */

export const HINT_TIERS = {
  OBSERVATION: 1,
  CONCEPT: 2,
  COMMAND_SHAPE: 3,
}

export const TIER_NAMES = {
  1: 'observation',
  2: 'concept',
  3: 'command_shape',
}

export const DEFAULT_PENALTIES = {
  1: 10,
  2: 25,
  3: 50,
}

export const DEFAULT_INCIDENTS = {
  'session-expiry': {
    id: 'session-expiry',
    symptoms: ['session_surviving_too_long', 'session_persistent', 'session-expiry'],
    hints: {
      1: 'The session is surviving longer than it should.',
      2: 'Check whether this key has an expiration time.',
      3: 'TTL <key>',
    },
    resolutionCommands: ['TTL', 'EXPIRE', 'PEXPIRE', 'PERSIST'],
  },
  'memory-leak': {
    id: 'memory-leak',
    symptoms: ['memory_growing', 'no_eviction', 'memory-leak'],
    hints: {
      1: 'Memory consumption is steadily climbing without freeing unused keys.',
      2: 'Keys without TTL remain in memory indefinitely unless evicted or expired.',
      3: 'EXPIRE <key> <seconds>',
    },
    resolutionCommands: ['EXPIRE', 'DEL', 'FLUSHDB', 'MEMORY'],
  },
  'wrong-data-type': {
    id: 'wrong-data-type',
    symptoms: ['wrong_type_error', 'invalid_key_type', 'wrong-data-type', 'WRONGTYPE'],
    hints: {
      1: 'The operation failed because the key holds a different structure than expected.',
      2: 'Redis commands are type-specific. Verify the underlying data structure of the key.',
      3: 'TYPE <key>',
    },
    resolutionCommands: ['TYPE', 'DEL'],
  },
  'slow-scan': {
    id: 'slow-scan',
    symptoms: ['slow_keys_search', 'blocking_scan', 'slow-scan'],
    hints: {
      1: 'Searching for keys is blocking the server and taking too long.',
      2: 'Avoid blocking commands like KEYS in production; scan iteratively instead.',
      3: 'SCAN <cursor> MATCH <pattern>',
    },
    resolutionCommands: ['SCAN', 'HSCAN', 'SSCAN', 'ZSCAN'],
  },
  'pubsub-delivery': {
    id: 'pubsub-delivery',
    symptoms: ['no_subscribers', 'missed_pubsub', 'pubsub-delivery'],
    hints: {
      1: 'Messages sent to the channel are vanishing without any receiver getting them.',
      2: 'Pub/Sub is fire-and-forget; subscribers must be actively subscribed before messages are published.',
      3: 'SUBSCRIBE <channel>',
    },
    resolutionCommands: ['SUBSCRIBE', 'PSUBSCRIBE', 'PUBLISH'],
  },
  'atomic-counter': {
    id: 'atomic-counter',
    symptoms: ['race_condition', 'counter_mismatch', 'atomic-counter'],
    hints: {
      1: 'Concurrent updates are causing lost increments and inaccurate counts.',
      2: 'Avoid read-modify-write cycles; use atomic increment operations.',
      3: 'INCR <key>',
    },
    resolutionCommands: ['INCR', 'INCRBY', 'INCRBYFLOAT'],
  },
}

export class HintEngine {
  constructor(options = {}) {
    this.penalties = { ...DEFAULT_PENALTIES, ...(options.penalties || {}) }
    this.incidents = new Map()
    this.symptomMap = new Map()
    this.usage = new Map() // incidentId -> { revealedTiers: Set, currentLevel: number, history: [], totalPenalty: number, failures: number, resolved: boolean }
    this.activeIncidentId = null

    // Register default incidents
    for (const [id, incident] of Object.entries(DEFAULT_INCIDENTS)) {
      this.registerIncident(id, incident)
    }

    if (options.incidents) {
      for (const [id, incident] of Object.entries(options.incidents)) {
        this.registerIncident(id, incident)
      }
    }
  }

  /**
   * Register a new incident with 3-tier hints and symptoms.
   */
  registerIncident(id, incidentData) {
    const incident = {
      id,
      symptoms: incidentData.symptoms || [id],
      hints: {
        1: incidentData.hints?.[1] || `Observation symptom for ${id}.`,
        2: incidentData.hints?.[2] || `Redis concept for ${id}.`,
        3: incidentData.hints?.[3] || `COMMAND <key> for ${id}.`,
      },
      resolutionCommands: incidentData.resolutionCommands || [],
    }

    this.incidents.set(id, incident)

    for (const symptom of incident.symptoms) {
      this.symptomMap.set(symptom, id)
    }

    if (!this.usage.has(id)) {
      this.usage.set(id, {
        incidentId: id,
        revealedTiers: new Set(),
        currentLevel: 0,
        history: [],
        totalPenalty: 0,
        failures: 0,
        resolved: false,
      })
    }
  }

  /**
   * Map symptomId to incidentId.
   */
  _resolveIncidentId(idOrSymptom) {
    if (this.incidents.has(idOrSymptom)) {
      return idOrSymptom
    }
    if (this.symptomMap.has(idOrSymptom)) {
      return this.symptomMap.get(idOrSymptom)
    }
    return idOrSymptom
  }

  /**
   * Ensure tracking record exists for an incident.
   */
  _ensureUsage(incidentId) {
    if (!this.usage.has(incidentId)) {
      this.usage.set(incidentId, {
        incidentId,
        revealedTiers: new Set(),
        currentLevel: 0,
        history: [],
        totalPenalty: 0,
        failures: 0,
        resolved: false,
      })
    }
    return this.usage.get(incidentId)
  }

  /**
   * 3-tier progressive hint accessor.
   * If level is provided (1, 2, 3), fetches that specific level.
   * If level is omitted, auto-progresses to the next level (1 -> 2 -> 3).
   * Tracks hint usage per incident to feed into score penalties.
   */
  getHint(incidentId, level) {
    const resolvedId = this._resolveIncidentId(incidentId)
    let incident = this.incidents.get(resolvedId)

    if (!incident) {
      // Dynamic fallback for unregistered incidents
      this.registerIncident(resolvedId, {
        hints: {
          1: `Observation: Issue detected for ${resolvedId}.`,
          2: `Concept: Check Redis configuration or data structure for ${resolvedId}.`,
          3: `Command: HELP ${resolvedId}`,
        },
      })
      incident = this.incidents.get(resolvedId)
    }

    const usage = this._ensureUsage(resolvedId)

    let targetLevel
    if (typeof level === 'number') {
      targetLevel = Math.max(1, Math.min(3, Math.floor(level)))
    } else if (typeof level === 'string' && ['observation', 'concept', 'command_shape'].includes(level)) {
      targetLevel = level === 'observation' ? 1 : level === 'concept' ? 2 : 3
    } else {
      // Progressive escalation when level is not specified
      targetLevel = Math.min(3, usage.currentLevel + 1)
    }

    usage.currentLevel = Math.max(usage.currentLevel, targetLevel)

    let penaltyAdded = 0
    if (!usage.revealedTiers.has(targetLevel)) {
      usage.revealedTiers.add(targetLevel)
      penaltyAdded = this.penalties[targetLevel] || 0
      usage.totalPenalty += penaltyAdded
    }

    const hintText = incident.hints[targetLevel]
    const hintRecord = {
      incidentId: resolvedId,
      level: targetLevel,
      tierName: TIER_NAMES[targetLevel],
      text: hintText,
      penalty: penaltyAdded,
      totalPenalty: usage.totalPenalty,
      speaker: 'REX',
      timestamp: Date.now(),
    }

    usage.history.push(hintRecord)
    this.activeIncidentId = resolvedId

    return hintRecord
  }

  /**
   * REX dialogue handler for symptoms.
   * Triggers Tier 1 (Observation) dialogue for the given symptomId.
   */
  onSymptom(symptomId) {
    const resolvedId = this._resolveIncidentId(symptomId)
    const usage = this._ensureUsage(resolvedId)
    this.activeIncidentId = resolvedId

    const hint = this.getHint(resolvedId, 1)

    return {
      speaker: 'REX',
      type: 'symptom_observation',
      symptomId,
      incidentId: resolvedId,
      level: 1,
      tierName: TIER_NAMES[1],
      text: hint.text,
      penalty: hint.penalty,
      totalPenalty: usage.totalPenalty,
      timestamp: Date.now(),
    }
  }

  /**
   * REX dialogue handler for command results.
   * Handles errors, suggests hint escalation, and detects incident resolutions.
   */
  onCommandResult(cmd, result, isError = false) {
    let cmdName = ''
    if (typeof cmd === 'string') {
      cmdName = cmd.trim().split(/\s+/)[0].toUpperCase()
    } else if (cmd && typeof cmd === 'object') {
      cmdName = (cmd.name || cmd.command || '').toUpperCase()
    }

    const activeId = this.activeIncidentId
    const activeUsage = activeId ? this.usage.get(activeId) : null

    if (isError) {
      if (activeUsage) {
        activeUsage.failures++
      }

      const errorStr = String(result || '')
      let detectedIncident = null
      let rexMessage = `REX: Encountered an error executing ${cmdName || 'command'}.`

      if (errorStr.includes('WRONGTYPE')) {
        detectedIncident = 'wrong-data-type'
        rexMessage = `REX: WRONGTYPE error! The key holds a different data structure than expected.`
      } else if (errorStr.includes('ERR wrong number of arguments')) {
        rexMessage = `REX: Incorrect number of arguments for ${cmdName}. Check command syntax.`
      } else if (errorStr.includes('ERR unknown command')) {
        rexMessage = `REX: '${cmdName}' is not a recognized Redis command.`
      } else {
        rexMessage = `REX: Command failed: ${errorStr}`
      }

      const targetId = detectedIncident || activeId
      const suggestedLevel = activeUsage && activeUsage.failures >= 2 ? 3 : 2

      return {
        speaker: 'REX',
        type: 'command_error',
        isError: true,
        command: cmdName,
        error: errorStr,
        text: rexMessage,
        incidentId: targetId,
        suggestedHintLevel: suggestedLevel,
        timestamp: Date.now(),
      }
    }

    // Success branch
    let resolvedIncidentId = null
    if (activeId && activeUsage && !activeUsage.resolved) {
      const incident = this.incidents.get(activeId)
      if (incident && incident.resolutionCommands.includes(cmdName)) {
        activeUsage.resolved = true
        resolvedIncidentId = activeId
      }
    }

    let successText = `REX: Executed ${cmdName || 'command'} successfully.`
    if (resolvedIncidentId) {
      successText = `REX: Excellent! Command ${cmdName} resolved incident '${resolvedIncidentId}'.`
    }

    return {
      speaker: 'REX',
      type: 'command_success',
      isError: false,
      command: cmdName,
      result,
      text: successText,
      resolvedIncidentId,
      timestamp: Date.now(),
    }
  }

  /**
   * Tracked hint usage for a specific incident.
   */
  getHintUsage(incidentId) {
    const resolvedId = this._resolveIncidentId(incidentId)
    const usage = this.usage.get(resolvedId)
    if (!usage) {
      return {
        incidentId: resolvedId,
        revealedTiers: [],
        currentLevel: 0,
        count: 0,
        totalPenalty: 0,
        failures: 0,
        resolved: false,
        history: [],
      }
    }

    return {
      incidentId: resolvedId,
      revealedTiers: Array.from(usage.revealedTiers).sort((a, b) => a - b),
      currentLevel: usage.currentLevel,
      count: usage.history.length,
      totalPenalty: usage.totalPenalty,
      failures: usage.failures,
      resolved: usage.resolved,
      history: [...usage.history],
    }
  }

  /**
   * Score penalty for a specific incident.
   */
  getScorePenalty(incidentId) {
    const resolvedId = this._resolveIncidentId(incidentId)
    const usage = this.usage.get(resolvedId)
    return usage ? usage.totalPenalty : 0
  }

  /**
   * Total score penalty across all tracked incidents.
   */
  getTotalPenalty() {
    let total = 0
    for (const usage of this.usage.values()) {
      total += usage.totalPenalty
    }
    return total
  }

  /**
   * Get active/unresolved incidents.
   */
  getActiveIncidents() {
    const active = []
    for (const [id, usage] of this.usage.entries()) {
      if (!usage.resolved && usage.currentLevel > 0) {
        active.push(id)
      }
    }
    return active
  }

  /**
   * Reset engine state.
   */
  reset() {
    this.usage.clear()
    this.activeIncidentId = null
    for (const id of this.incidents.keys()) {
      this.usage.set(id, {
        incidentId: id,
        revealedTiers: new Set(),
        currentLevel: 0,
        history: [],
        totalPenalty: 0,
        failures: 0,
        resolved: false,
      })
    }
  }

  /**
   * Serialize for save manager.
   */
  serialize() {
    const serializedUsage = {}
    for (const [id, usage] of this.usage.entries()) {
      serializedUsage[id] = {
        ...usage,
        revealedTiers: Array.from(usage.revealedTiers),
      }
    }
    return {
      activeIncidentId: this.activeIncidentId,
      usage: serializedUsage,
    }
  }

  /**
   * Hydrate from save manager.
   */
  hydrate(data) {
    if (!data) return
    if (data.activeIncidentId !== undefined) {
      this.activeIncidentId = data.activeIncidentId
    }
    if (data.usage) {
      for (const [id, usageData] of Object.entries(data.usage)) {
        this.usage.set(id, {
          ...usageData,
          revealedTiers: new Set(usageData.revealedTiers || []),
        })
      }
    }
  }
}

export function createHintEngine(options) {
  return new HintEngine(options)
}

export default HintEngine
